-- Richer task state: a status, a priority and a start date on checklist items.
--
-- status:  not_started, in_progress, testing, awaiting_feedback, complete.
-- priority: low, medium, high, urgent.
-- is_done stays, because the client console, the milestone progress bars and the ops MCP all read
-- it. A trigger keeps the two in step: setting the status to complete marks the task done; marking
-- it done (or not done) sets the status to match. Whichever column a write changes wins.
--
-- Apply as supabase_admin; safe to run twice.

alter table console.deliverable_tasks
  add column if not exists status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'testing', 'awaiting_feedback', 'complete')),
  add column if not exists priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  add column if not exists start_at date;

-- Existing tasks: finished ones are complete, the rest not started.
update console.deliverable_tasks set status = 'complete' where is_done and status <> 'complete';

create or replace function console.deliverable_tasks_sync_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    -- A task created done is complete; one created with status complete is done.
    if new.is_done and new.status <> 'complete' then
      new.status := 'complete';
    end if;
    new.is_done := (new.status = 'complete');
  else
    if new.status is distinct from old.status then
      new.is_done := (new.status = 'complete');
    elsif new.is_done is distinct from old.is_done then
      if new.is_done then
        new.status := 'complete';
      elsif new.status = 'complete' then
        new.status := 'not_started';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists deliverable_tasks_sync_status on console.deliverable_tasks;
create trigger deliverable_tasks_sync_status
  before insert or update on console.deliverable_tasks
  for each row execute function console.deliverable_tasks_sync_status();

notify pgrst, 'reload schema';
