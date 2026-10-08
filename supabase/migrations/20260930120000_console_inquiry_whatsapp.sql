-- WhatsApp messages on a lead's timeline.
--
-- console-inquiry-notify now also sends the acknowledgement on WhatsApp
-- (via a self-hosted Evolution API instance) to leads who ticked the
-- WhatsApp opt-in, and console-whatsapp-webhook records what they send
-- back. Both land in console.inquiry_activities next to the emails, so a
-- lead's history stays in one place.
--
-- whatsapp_opted_out_at records a STOP reply. It is kept separately from
-- whatsapp_opt_in so the Leads view can tell "never opted in" from
-- "opted in, then said stop".

alter table console.inquiry_activities
  drop constraint inquiry_activities_activity_type_check,
  add constraint inquiry_activities_activity_type_check
    check (activity_type in (
      'note', 'stage_change', 'agent_auto_action', 'agent_proposal', 'email_sent',
      'whatsapp_sent', 'whatsapp_received'
    ));

alter table console.inquiries
  add column whatsapp_opted_out_at timestamptz;

create index inquiries_phone_idx on console.inquiries (phone) where phone is not null;
