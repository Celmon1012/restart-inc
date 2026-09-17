-- A recipient for client-facing deliverable update emails (see
-- console-deliverable-send). Nullable and staff-set, same pattern as
-- lago_customer_id -- a workspace can exist and show delivery status
-- before a contact email is on file; sending is simply blocked with a
-- clear error until one is set, rather than guessing a recipient.
alter table console.workspaces
  add column contact_email text;
