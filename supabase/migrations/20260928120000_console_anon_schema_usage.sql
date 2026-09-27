-- Let anonymous visitors actually reach console.inquiries.
--
-- 20260917120000_console_inquiries.sql granted INSERT on the table to anon,
-- but 20260916120000_console_workspaces.sql only granted USAGE on the
-- schema to authenticated and service_role. Without schema USAGE the table
-- grant is unreachable: every signed-out submission from /start-project,
-- /scorecard and /contact fails with 42501 "permission denied for schema
-- console". It only ever worked for someone already signed in to the
-- console, which is how it passed testing.
--
-- USAGE alone exposes nothing: anon still needs a per-object grant, and the
-- only one it holds is INSERT on console.inquiries (read-back stays
-- admin-only via RLS). Every security-definer function in console.* already
-- revokes EXECUTE from public and anon.

grant usage on schema console to anon;
