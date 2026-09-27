/**
 * Readiness Scorecard: 12 questions across 6 areas, each answer
 * scored 0-3. The overall score is the percentage of the 36 available points.
 * Recommendations are written as the first concrete step, not a pitch.
 */

export interface ScoreOption {
  label: string;
  score: 0 | 1 | 2 | 3;
}

export interface ScoreQuestion {
  id: string;
  prompt: string;
  options: ScoreOption[];
}

export interface ScoreArea {
  id: string;
  title: string;
  questions: ScoreQuestion[];
  /** Shown when this area is among the weakest. */
  nextStep: string;
}

export const SCORE_AREAS: ScoreArea[] = [
  {
    id: "observability",
    title: "Observability & incidents",
    nextStep: "Alert on error rate and latency, not just uptime, and name one on-call owner per system. Most outages are noticed by customers first because nothing watches the signals that degrade before a crash.",
    questions: [
      {
        id: "obs-detect",
        prompt: "When something breaks in production, how do you usually find out?",
        options: [
          { label: "A customer tells us", score: 0 },
          { label: "Someone notices while checking manually", score: 1 },
          { label: "Uptime alerts", score: 2 },
          { label: "Alerts on errors and latency, routed to a named owner", score: 3 },
        ],
      },
      {
        id: "obs-trace",
        prompt: "Can you follow a single failed request through your system?",
        options: [
          { label: "No", score: 0 },
          { label: "Per-service logs, if we know where to look", score: 1 },
          { label: "Centralised, searchable logs", score: 2 },
          { label: "Correlated logs and traces across services", score: 3 },
        ],
      },
    ],
  },
  {
    id: "delivery",
    title: "Deployment & change safety",
    nextStep: "Put every deploy through one pipeline with tests and a rollback you have actually rehearsed. The goal is that shipping on a Friday is boring, not brave.",
    questions: [
      {
        id: "del-path",
        prompt: "How does code reach production?",
        options: [
          { label: "Manually (SSH, FTP, or a dashboard)", score: 0 },
          { label: "A script one person runs", score: 1 },
          { label: "A CI pipeline", score: 2 },
          { label: "CI with tests, preview environments, and one-step rollback", score: 3 },
        ],
      },
      {
        id: "del-incidents",
        prompt: "How often does a deploy cause an incident?",
        options: [
          { label: "Often", score: 0 },
          { label: "Now and then", score: 1 },
          { label: "Rarely", score: 2 },
          { label: "Rarely, and rolling back takes minutes", score: 3 },
        ],
      },
    ],
  },
  {
    id: "data",
    title: "Data & recovery",
    nextStep: "Restore last night's backup into a scratch environment and time it. An untested backup is a hope; a timed restore is a recovery objective you can promise.",
    questions: [
      {
        id: "data-backup",
        prompt: "What happens to your data if the primary database is lost?",
        options: [
          { label: "We're not sure", score: 0 },
          { label: "We rely on the provider's default backups", score: 1 },
          { label: "Automated off-site backups", score: 2 },
          { label: "Automated off-site backups with a restore tested in the last 90 days", score: 3 },
        ],
      },
      {
        id: "data-migrations",
        prompt: "How are database schema changes made?",
        options: [
          { label: "Edited directly on the live database", score: 0 },
          { label: "Hand-run SQL scripts", score: 1 },
          { label: "Versioned migrations", score: 2 },
          { label: "Versioned, reversible migrations that run without downtime", score: 3 },
        ],
      },
    ],
  },
  {
    id: "security",
    title: "Security & access",
    nextStep: "Replace shared credentials with individual accounts behind MFA, and move secrets out of code into a secret manager. Both are a week of work and close the most common breach paths.",
    questions: [
      {
        id: "sec-access",
        prompt: "Who can access production, and how?",
        options: [
          { label: "Shared logins", score: 0 },
          { label: "Individual accounts, broad access", score: 1 },
          { label: "Least-privilege individual accounts", score: 2 },
          { label: "Least-privilege, SSO/MFA, and access is audited", score: 3 },
        ],
      },
      {
        id: "sec-secrets",
        prompt: "Where do API keys and passwords live?",
        options: [
          { label: "In the codebase", score: 0 },
          { label: "Env files passed around the team", score: 1 },
          { label: "A secret manager", score: 2 },
          { label: "A secret manager, with rotation", score: 3 },
        ],
      },
    ],
  },
  {
    id: "architecture",
    title: "Architecture & scale",
    nextStep: "Enforce customer data boundaries in the database, not only in application code, then load-test your busiest flow so you know your real ceiling before a launch finds it for you.",
    questions: [
      {
        id: "arch-isolation",
        prompt: "How is one customer's data kept separate from another's?",
        options: [
          { label: "We haven't had to think about it", score: 0 },
          { label: "Filters in application code", score: 1 },
          { label: "Enforced in the database (row-level security or separate schemas)", score: 2 },
          { label: "Enforced in the database and covered by tests", score: 3 },
        ],
      },
      {
        id: "arch-load",
        prompt: "What happens at your busiest moments?",
        options: [
          { label: "We don't know our limits", score: 0 },
          { label: "Things slow down or fail at peaks", score: 1 },
          { label: "We cope by scaling up manually", score: 2 },
          { label: "Load-tested; we know our headroom", score: 3 },
        ],
      },
    ],
  },
  {
    id: "ownership",
    title: "Ownership & documentation",
    nextStep: "Write down how the system is deployed, recovered, and extended, and make one senior person accountable for it end to end. If that knowledge lives in one head, it leaves with them.",
    questions: [
      {
        id: "own-knowledge",
        prompt: "If your lead engineer left tomorrow, how would the team cope?",
        options: [
          { label: "Badly: it's all in one person's head", score: 0 },
          { label: "Partial docs; we'd work it out slowly", score: 1 },
          { label: "The architecture is documented", score: 2 },
          { label: "Documented, with runbooks the team already uses", score: 3 },
        ],
      },
      {
        id: "own-decisions",
        prompt: "Who owns technical decisions through to production?",
        options: [
          { label: "No one clearly", score: 0 },
          { label: "An agency or freelancer, project by project", score: 1 },
          { label: "An internal lead, part-time", score: 2 },
          { label: "A senior owner accountable from design through operation", score: 3 },
        ],
      },
    ],
  },
];

export const TOTAL_QUESTIONS = SCORE_AREAS.reduce((n, a) => n + a.questions.length, 0);

export interface ScoreBand {
  min: number;
  label: string;
  summary: string;
}

export const SCORE_BANDS: ScoreBand[] = [
  { min: 85, label: "Operationally mature", summary: "Your system is built to be run, not just shipped. The gains left are in cost, speed, and scale." },
  { min: 65, label: "Production-ready, with gaps", summary: "The foundations are sound. A few gaps would turn a bad day into a long one." },
  { min: 40, label: "Functional, with real exposure", summary: "It works today, but it depends on luck and specific people more than it should." },
  { min: 0, label: "Fragile", summary: "An outage, a bad deploy, or a departure would hurt. The good news: the first fixes are well understood." },
];

export function bandFor(score: number): ScoreBand {
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}
