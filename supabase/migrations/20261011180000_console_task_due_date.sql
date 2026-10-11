-- A deadline per checklist item (a date; null means none).
-- Shown on the Tasks page (overdue ones highlighted) and on the client's
-- Delivery view next to each task.

alter table console.deliverable_tasks
  add column if not exists due_at date;

create index if not exists deliverable_tasks_due_idx on console.deliverable_tasks (due_at) where due_at is not null;

notify pgrst, 'reload schema';
