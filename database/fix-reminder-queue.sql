create or replace function public.avenli_queue_reminders() returns integer language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 update public.avenli_notifications n set email_state='skipped' from public.avenli_tasks t where n.task_id=t.id and n.email_state='pending' and (t.status='done' or t.reminder_at is distinct from n.scheduled_at);
 insert into public.avenli_notifications(owner_id,task_id,dedupe_key,title,body,email_state,scheduled_at)
 select t.owner_id,t.id,t.id::text||':'||t.reminder_at::text,'A little reminder',t.title,case when s.email_reminders then 'pending' else 'skipped' end,t.reminder_at
 from public.avenli_tasks t join public.avenli_settings s using(owner_id)
 where t.status<>'done' and t.reminder_at<=now() on conflict(dedupe_key) do nothing;
 get diagnostics affected=row_count;
 insert into public.avenli_notifications(owner_id,dedupe_key,title,body,email_state,scheduled_at)
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



select public.avenli_queue_reminders();
