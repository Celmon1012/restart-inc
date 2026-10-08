---
name: prospecting
description: Restart's outbound prospecting workflow. Use to find, research, score and draft outreach to B2B prospects (Nigerian and international SMEs) through the restart-outreach MCP tools, or to review drafts and follow-ups.
---

# Prospecting for Restart

Tools come from the `restart-outreach` MCP server (`add_prospect`, `save_research`, `save_score`, `draft_outreach`, `list_pending_drafts`, `mark_touch_sent`, `log_reply`, `list_due_followups`, `set_prospect_status`, `mark_do_not_contact`, `pipeline_summary`). If they are missing, the server is not connected: say so and stop.

**Nothing is sent from here.** Drafts are saved for the user to send by hand. Call `mark_touch_sent` only after the user says they sent it.

> DRAFT ICP: derived from `pricing-strategy.md`, not yet confirmed by the user. Edit the sections marked (edit) as real sales data comes in.

## Who Restart sells to (edit)

Founders and operators of small and mid-sized companies whose business already runs on software they don't own well: a product built by a freelancer who left, an ops process held together by spreadsheets and WhatsApp, a store or platform with no one accountable for uptime.

- **Nigerian SMEs** (`ng_sme`): 11-200 staff, trading in NGN, paying through Paystack/Flutterwave or bank transfer. Sectors to start with: logistics, retail/e-commerce, fintech-adjacent services, healthcare and clinics, schools, professional services. Priced from the NGN ladder.
- **International SMEs** (`intl_sme`): same shape, USD/GBP/EUR, often diaspora-founded or with Nigerian ties. Priced from the USD ladder.

Offer ladder to match against (see `pricing-strategy.md`): Architecture Audit (lead-in), MVP Build or Medusa Commerce Build (core), DevOps Retainer (recurring). **Lead with the Audit** unless the prospect clearly has a build in mind.

## Workflow

1. **Intake.** `add_prospect` with whatever is known. Always set `segment`; set `tier` `warm` for referrals and past contacts.
2. **Research.** Look at the company's site, product, careers page, reviews, and public stack signals (page source, status page, app store listings). Write the brief in this shape, then `save_research` with source URLs:
   - What they do and who pays them.
   - What runs their operations (stack, platforms, tools), noting what you verified versus inferred.
   - The specific problem: something observable (slow checkout, broken mobile flow, no status page, abandoned repo, manual process), ideally with a number.
   - The hook: one sentence the contact would recognise as true about them.
   - Disqualifiers: too small to pay, already has a strong in-house team, wrong sector, recently raised and hiring engineers.
3. **Score.** `save_score` with 0-100 and a one-line reason:

   | Factor | Points |
   |---|---|
   | Observable pain Restart can fix | 30 |
   | Ability to pay (size, funding, pricing, ops scale) | 25 |
   | Fit with an offer on the ladder | 20 |
   | Decision-maker identified and reachable | 15 |
   | Timing trigger (hiring, launch, outage, funding, new market) | 10 |

   75+ = tier A (deep personalisation), 50-74 = tier B, under 50 = do not contact (`set_prospect_status` disqualified with a note).
4. **Draft.** `draft_outreach`, one step at a time. Rules below.
5. **Review loop.** `list_pending_drafts`, show the user each draft with the prospect's brief summary, apply edits (save the revised draft as a new draft), and remind them to send.
6. **Follow-ups.** `list_due_followups`; draft the next step for each. Stop after step 3 with no reply and mark `lost` with a note.
7. **Replies.** When the user pastes a reply, `log_reply` with an honest classification. Never argue with `not_interested` or `unsubscribe`.

## Writing the message

Restart's voice rule applies: **a metric or a named stack, never an adjective.** Cut "powerful", "seamless", "cutting-edge", "solutions", "leverage". Read it as one operator talking to another.

- Email: under 90 words. Subject under 6 words, no clickbait, no "Re:".
- Open with the specific, verifiable observation about *them*. Not "I came across your company".
- One sentence on what Restart would do about it, tied to an offer and, where honest, a number from a real engagement (only numbers from `content/` or the case studies; never invent one).
- One low-friction ask: a 20-minute call, or a fixed-scope, fixed-price Architecture Audit. No multi-option menus.
- Sign with a named senior person, not "the team".
- Email must carry a plain one-line opt-out ("Reply 'no' and I won't write again"). Honour it immediately via `log_reply` with `unsubscribe`.
- WhatsApp: only for `warm` prospects or ones who replied or gave their number themselves. Never cold-message a number scraped from a directory. Two sentences, no attachments.
- LinkedIn: connection note under 280 characters, no pitch.
- Sequence: step 1 day 0, step 2 about day 4 (add one new fact, not "just bumping"), step 3 about day 10 (short, closes the loop). Then stop.

## Hard rules

- Never draft for a prospect with `do_not_contact`, or after `won`, `lost` or `disqualified`, without the user explicitly reopening it.
- Never state facts about a company you have not verified; mark inferences as inferences in the brief and keep them out of the message unless phrased as a question.
- Nigerian prospects: collect only business contact details needed for the outreach, and keep the opt-out working (NDPA).
- Do not enrich or scrape personal data beyond a business contact's name, role, work email, work phone and professional profile.
- Quote prices only from `pricing-strategy.md`, in the prospect's currency. Never show USD figures to NGN prospects.
