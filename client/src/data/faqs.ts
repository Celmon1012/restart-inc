// Homepage FAQs. Also read at build time by scripts/prerender-insights.mjs,
// which bakes them into the homepage HTML as FAQPage structured data.
export const faqs: [question: string, answer: string][] = [
  ["Are you available right now?", "We work with a limited number of active engagements so senior technical ownership remains real. Send us what you are building and the constraint you are facing; we will tell you quickly whether the timing and fit make sense."],
  ["What should the first email actually say?", "Send the short version: what you are building, what is not working, where the risk sits, and what decision you need to make next. A rough outline is enough."],
  ["What happens after I book the intro call?", "We review the context before the call, use the conversation to clarify the system and the constraint, then recommend the smallest useful next step — whether that is a build, sprint, audit, or no engagement yet."],
  ["Will you take an equity-only project?", "Our default model is paid, scoped delivery. If there is a strong strategic fit, we can discuss alternatives, but we do not use equity-only work as the standard engagement model."],
  ["Can I see code samples?", "We can share relevant examples, architecture patterns, delivery files, and case-study detail where confidentiality allows. The most useful proof is usually how the system performs under its real constraints."],
  ["What about rates, contracts, and time zones?", "We scope work around a defined outcome, timeline, and delivery model before starting. We will make the commercial structure and working cadence clear during the first conversation."],
];
