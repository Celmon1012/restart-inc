-- Chatwoot's Client API (the only API that can create a genuine
-- contact-originated message -- see console-support-create's comment for
-- why) is keyed by inbox_identifier + a per-contact-inbox source_id, not
-- the numeric ids used elsewhere. Persisted here so a later reply from
-- the same client (console-support-reply) can post through the same
-- Client API path without re-deriving it.
--
-- Nullable: the one conversation created before this existed has no
-- source_id on file and simply can't take a client-side reply through
-- the Client API until re-created -- not worth a backfill for a test row.
alter table console.support_conversations
  add column chatwoot_source_id text;
