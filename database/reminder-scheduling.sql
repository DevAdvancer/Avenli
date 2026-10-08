alter table public.avenli_tasks add column recurrence_parent_id uuid unique;
alter table public.avenli_notifications add column scheduled_at timestamptz;
create or replace function public.avenli_complete_task(p_owner text,p_id uuid,p_done boolean) returns void language plpgsql security invoker set search_path='' as $$
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
   insert into public.avenli_tasks(owner_id,title,notes,area,priority,due_date,due_time,my_day,recurrence,goal_id,subtasks,reminder_at,recurrence_parent_id)
   values(p_owner,t.title,t.notes,t.area,t.priority,next_date,t.due_time,false,t.recurrence,t.goal_id,
    coalesce((select jsonb_agg(x || '{"done":false}'::jsonb) from jsonb_array_elements(t.subtasks) x),'[]'),
    case when t.reminder_at is not null then ((t.reminder_at at time zone tz)+(next_date-coalesce(t.due_date,(t.reminder_at at time zone tz)::date))*interval '1 day') at time zone tz else null end,t.id) on conflict(recurrence_parent_id) do nothing;
  end if;
 end if;
end $$;
revoke all on function public.avenli_complete_task(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.avenli_complete_task(text,uuid,boolean) to service_role;


create or replace function public.avenli_queue_reminders() returns integer language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 update public.avenli_notifications n set email_state='skipped' from public.avenli_tasks t where n.task_id=t.id and n.email_state='pending' and (t.status='done' or t.reminder_at is distinct from n.scheduled_at);
 insert into public.avenli_notifications(owner_id,task_id,dedupe_key,title,body,email_state,scheduled_at)
 select t.owner_id,t.id,t.id::text||':'||t.reminder_at::text,'A little reminder',t.title,case when s.email_reminders then 'pending' else 'skipped' end,t.reminder_at
 from public.avenli_tasks t join public.avenli_settings s using(owner_id)
 where t.status<>'done' and t.reminder_at<=now() on conflict(dedupe_key) do nothing;
 get diagnostics affected=row_count;
 insert into public.avenli_notifications(owner_id,dedupe_key,title,body,email_state)
 select s.owner_id,'digest:'||s.owner_id||':'||(now() at time zone s.timezone)::date::text,'Your day with Avenli',
  'You have '||(select count(*) from public.avenli_tasks t where t.owner_id=s.owner_id and t.status<>'done' and (t.due_date<=(now() at time zone s.timezone)::date or t.my_day))::text||' tasks to consider today. Open Avenli to make room for what matters.','pending',null
 from public.avenli_settings s where s.daily_digest and extract(hour from now() at time zone s.timezone)=s.digest_hour
 on conflict(dedupe_key) do nothing;
 delete from public.avenli_request_nonces where created_at<now()-interval '10 minutes';
 -- A stale SMTP claim is marked failed rather than silently resending after an uncertain handoff.
 update public.avenli_notifications set email_state='failed',last_error='Delivery could not be confirmed. Check your inbox before retrying.' where email_state='processing' and claimed_at<now()-interval '10 minutes';
 return affected;
end $$;
revoke all on function public.avenli_queue_reminders() from public,anon,authenticated;
grant execute on function public.avenli_queue_reminders() to service_role;


create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('avenli-reminders','* * * * *',$job$ select net.http_post(url:='https://dpahxvrwkyihqukermji.supabase.co/functions/v1/avenli-api', headers:=jsonb_build_object('Content-Type','application/json','x-avenli-cron',(select decrypted_secret from vault.decrypted_secrets where name='avenli_cron_secret')),body:='{}'::jsonb,timeout_milliseconds:=60000); $job$);
