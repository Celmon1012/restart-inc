-- Links a workspace to its Lago customer, the same way coolify_project_uuid
-- links it to its Coolify project. Nullable: a workspace can exist (and show
-- Coolify data) before billing is set up for it -- the two are independent.
alter table console.workspaces
  add column lago_customer_id text unique;
