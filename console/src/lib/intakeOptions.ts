// Option ids must match the checks in console.complete_onboarding() and
// console.create_project() -- both functions reject anything else.

export const ENGAGEMENTS = [
  { id: "build", label: "Build something new", hint: "A product, platform, or internal tool" },
  { id: "scale", label: "Fix, scale, or migrate a system", hint: "Something live that's under pressure" },
  { id: "ai", label: "Add an AI capability", hint: "Agents, LLM features, or automation" },
  { id: "advisory", label: "Architecture or technical leadership", hint: "A review or senior direction" },
  { id: "exploring", label: "Just looking around", hint: "No project in mind yet" }
];

export const TIMELINES = [
  { id: "now", label: "Within 2 weeks" },
  { id: "30d", label: "Within 30 days" },
  { id: "quarter", label: "Next quarter" },
  { id: "later", label: "Planning ahead" }
];

export const BUDGETS = [
  { id: "lt10k", label: "Under $10k" },
  { id: "10-25k", label: "$10k–$25k" },
  { id: "25-50k", label: "$25k–$50k" },
  { id: "50-100k", label: "$50k–$100k" },
  { id: "100k+", label: "$100k+" },
  { id: "unset", label: "Not set yet" }
];

