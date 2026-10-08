-- Avenli: private app data. Sites verifies user identity, signs requests, and the
-- Edge Function performs fixed, owner-scoped operations. Direct clients get no grants.
create schema if not exists avenli_private;
revoke all on schema avenli_private from public, anon, authenticated;
create table public.avenli_settings (
 owner_id text primary key, display_name text not null default '', email text not null,
 timezone text not null default 'America/New_York', email_reminders boolean not null default false,
 daily_digest boolean not null default false, digest_hour smallint not null default 8 check(digest_hour between 0 and 23),
 quiet_start smallint not null default 22 check(quiet_start between 0 and 23), quiet_end smallint not null default 7 check(quiet_end between 0 and 23),
 focus_minutes smallint not null default 25 check(focus_minutes between 5 and 120), updated_at timestamptz not null default now()
);
create table public.avenli_goals (
 id uuid primary key default gen_random_uuid(), owner_id text not null references public.avenli_settings(owner_id) on delete cascade,
 title text not null check(length(title) between 1 and 240), notes text not null default '', area text not null default 'Personal growth',
 target_date date, target numeric not null default 1 check(target>0 and target<=1000000), current numeric not null default 0 check(current>=0 and current<=1000000),
 unit text not null default 'milestones', created_at timestamptz not null default now(), unique(owner_id,id)
);
create table public.avenli_tasks (
 id uuid primary key default gen_random_uuid(), owner_id text not null references public.avenli_settings(owner_id) on delete cascade,
 title text not null check(length(title) between 1 and 240), notes text not null default '', area text not null default 'Life admin',
 priority text not null default 'medium' check(priority in('high','medium','low')),status text not null default 'todo' check(status in('todo','in_progress','done')),
 due_date date, due_time time, my_day boolean not null default false, recurrence text not null default 'none' check(recurrence in('none','daily','weekly','monthly')),
 goal_id uuid, subtasks jsonb not null default '[]', reminder_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(),
 foreign key(owner_id,goal_id) references public.avenli_goals(owner_id,id) on delete set null (goal_id)
);
create index avenli_tasks_owner_date on public.avenli_tasks(owner_id,due_date);
create index avenli_tasks_goal on public.avenli_tasks(owner_id,goal_id);
create index avenli_tasks_reminders on public.avenli_tasks(reminder_at) where status<>'done' and reminder_at is not null;
create index avenli_goals_owner on public.avenli_goals(owner_id);
create table public.avenli_notifications (
 id uuid primary key default gen_random_uuid(), owner_id text not null references public.avenli_settings(owner_id) on delete cascade,
 task_id uuid references public.avenli_tasks(id) on delete cascade, dedupe_key text unique not null, title text not null, body text not null,
 read_at timestamptz, email_state text not null default 'skipped' check(email_state in('pending','processing','sent','failed','skipped')),
 attempts integer not null default 0, last_error text, claimed_at timestamptz, created_at timestamptz not null default now()
);
create index avenli_notifications_owner on public.avenli_notifications(owner_id,created_at desc);
create index avenli_notifications_task on public.avenli_notifications(task_id);
create index avenli_notifications_pending on public.avenli_notifications(created_at) where email_state='pending';
create table public.avenli_focus (
 id uuid primary key, owner_id text not null references public.avenli_settings(owner_id) on delete cascade,
 minutes integer not null check(minutes between 1 and 180), completed_at timestamptz not null default now()
);
create index avenli_focus_owner on public.avenli_focus(owner_id,completed_at);
create table public.avenli_request_nonces(nonce uuid primary key, created_at timestamptz not null default now());
alter table public.avenli_settings enable row level security;
alter table public.avenli_goals enable row level security;
alter table public.avenli_tasks enable row level security;
alter table public.avenli_notifications enable row level security;
alter table public.avenli_focus enable row level security;
alter table public.avenli_request_nonces enable row level security;
revoke all on public.avenli_settings,public.avenli_goals,public.avenli_tasks,public.avenli_notifications,public.avenli_focus,public.avenli_request_nonces from anon,authenticated;
grant all on public.avenli_settings,public.avenli_goals,public.avenli_tasks,public.avenli_notifications,public.avenli_focus,public.avenli_request_nonces to service_role;

-- Fixed allowlist; only the platform service identity can read app secrets.
create function avenli_private.runtime_config() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','') <> 'service_role' then raise exception 'Unauthorized'; end if;
 return (select jsonb_object_agg(name,decrypted_secret) from vault.decrypted_secrets where name in ('avenli_backend_secret','avenli_cron_secret','avenli_smtp_password'));
end $$;
revoke all on function avenli_private.runtime_config() from public,anon,authenticated;
grant usage on schema avenli_private to service_role;
grant execute on function avenli_private.runtime_config() to service_role;
create function public.avenli_runtime_config() returns jsonb language sql security invoker set search_path='' as $$ select avenli_private.runtime_config() $$;
revoke all on function public.avenli_runtime_config() from public,anon,authenticated;
grant execute on function public.avenli_runtime_config() to service_role;

-- Completing a repeating task is one atomic operation, including its next occurrence.
create function public.avenli_complete_task(p_owner text,p_id uuid,p_done boolean) returns void language plpgsql security invoker set search_path='' as $$
declare t public.avenli_tasks; next_date date; delta interval; tz text;
begin
 select * into t from public.avenli_tasks where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'Task not found'; end if;
 if p_done and t.status='done' then return; end if;
 update public.avenli_tasks set status=case when p_done then 'done' else 'todo' end,completed_at=case when p_done then now() else null end where id=t.id;
 if p_done then
  update public.avenli_notifications set email_state='skipped' where task_id=t.id and email_state='pending';
  if t.recurrence<>'none' then
   select timezone into tz from public.avenli_settings where owner_id=p_owner;
   delta:=case t.recurrence when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end;
   next_date:=(greatest(coalesce(t.due_date,(now() at time zone tz)::date),(now() at time zone tz)::date)+delta)::date;
   insert into public.avenli_tasks(owner_id,title,notes,area,priority,due_date,due_time,my_day,recurrence,goal_id,subtasks,reminder_at)
   values(p_owner,t.title,t.notes,t.area,t.priority,next_date,t.due_time,false,t.recurrence,t.goal_id,
    coalesce((select jsonb_agg(x || '{"done":false}'::jsonb) from jsonb_array_elements(t.subtasks) x),'[]'),
    case when t.reminder_at is not null then ((t.reminder_at at time zone tz)+(next_date-coalesce(t.due_date,(t.reminder_at at time zone tz)::date))*interval '1 day') at time zone tz else null end);
  end if;
 end if;
end $$;
revoke all on function public.avenli_complete_task(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.avenli_complete_task(text,uuid,boolean) to service_role;

create function public.avenli_queue_reminders() returns integer language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 insert into public.avenli_notifications(owner_id,task_id,dedupe_key,title,body,email_state)
 select t.owner_id,t.id,t.id::text||':'||t.reminder_at::text,'A little reminder',t.title,case when s.email_reminders then 'pending' else 'skipped' end
 from public.avenli_tasks t join public.avenli_settings s using(owner_id)
 where t.status<>'done' and t.reminder_at<=now() on conflict(dedupe_key) do nothing;
 get diagnostics affected=row_count;
 insert into public.avenli_notifications(owner_id,dedupe_key,title,body,email_state)
 select s.owner_id,'digest:'||s.owner_id||':'||(now() at time zone s.timezone)::date::text,'Your day with Avenli',
  'You have '||(select count(*) from public.avenli_tasks t where t.owner_id=s.owner_id and t.status<>'done' and (t.due_date<=(now() at time zone s.timezone)::date or t.my_day))::text||' tasks to consider today. Open Avenli to make room for what matters.','pending'
 from public.avenli_settings s where s.daily_digest and extract(hour from now() at time zone s.timezone)=s.digest_hour
 on conflict(dedupe_key) do nothing;
 delete from public.avenli_request_nonces where created_at<now()-interval '10 minutes';
 -- A stale SMTP claim is marked failed rather than silently resending after an uncertain handoff.
 update public.avenli_notifications set email_state='failed',last_error='Delivery could not be confirmed. Check your inbox before retrying.' where email_state='processing' and claimed_at<now()-interval '10 minutes';
 return affected;
end $$;
revoke all on function public.avenli_queue_reminders() from public,anon,authenticated;
grant execute on function public.avenli_queue_reminders() to service_role;

create function public.avenli_claim_emails() returns setof public.avenli_notifications language sql security invoker set search_path='' as $$
 update public.avenli_notifications n set email_state='processing',claimed_at=now(),attempts=attempts+1
 where n.id in (select q.id from public.avenli_notifications q join public.avenli_settings s using(owner_id)
 where q.email_state='pending' and q.attempts<3 and (
 s.quiet_start=s.quiet_end or (s.quiet_start<s.quiet_end and (extract(hour from now() at time zone s.timezone)<s.quiet_start or extract(hour from now() at time zone s.timezone)>=s.quiet_end))
 or (s.quiet_start>s.quiet_end and extract(hour from now() at time zone s.timezone)>=s.quiet_end and extract(hour from now() at time zone s.timezone)<s.quiet_start))
 order by q.created_at limit 20 for update of q skip locked) returning n.*;
$$;
revoke all on function public.avenli_claim_emails() from public,anon,authenticated;
grant execute on function public.avenli_claim_emails() to service_role;
