// Starting milestones and checklists for a new project, by engagement type. Applying one adds
// the milestones (and their tasks) to a project in one go, so nobody retypes the same plan.
//
// Milestone titles and descriptions are what the client sees on their Delivery tab, so they are
// written for the client. Tasks marked `client: true` are things the client has to do or send;
// the rest are Restart's own work. `days` is how many days after the start the milestone is due.
// Applying a template only adds: nothing already on the project is touched, and every item can be
// edited or removed afterwards.

import { consoleSchema } from "@/lib/supabase";

export interface TemplateTask {
  title: string;
  client?: boolean;
}

export interface TemplateMilestone {
  title: string;
  description: string;
  days: number;
  tasks: TemplateTask[];
}

export interface ProjectTemplate {
  name: string;
  milestones: TemplateMilestone[];
}

export const PROJECT_TEMPLATES: Record<string, ProjectTemplate> = {
  build: {
    name: "Build",
    milestones: [
      {
        title: "Scope and plan",
        description: "We agree what is being built, how it will be judged, and the dates.",
        days: 5,
        tasks: [
          { title: "Confirm scope and the measures of success" },
          { title: "Agree the timeline and the delivery milestones" },
          { title: "Share brand assets, content and any existing accounts we need", client: true },
          { title: "Give us access to the domain, hosting and any third-party tools", client: true }
        ]
      },
      {
        title: "Design",
        description: "The structure and look of the product, agreed before anything is built.",
        days: 14,
        tasks: [
          { title: "Map the pages or screens and how people move between them" },
          { title: "Produce the design for review" },
          { title: "Review the design and send back changes", client: true },
          { title: "Approve the final design", client: true }
        ]
      },
      {
        title: "Build",
        description: "The product is built on its own server, ready for review.",
        days: 35,
        tasks: [
          { title: "Set up the server, environments and backups" },
          { title: "Build the core features" },
          { title: "Connect payments, email and any integrations" },
          { title: "Load the real content" }
        ]
      },
      {
        title: "Review and testing",
        description: "You test it, we fix what you find, and we check speed, security and mobile.",
        days: 42,
        tasks: [
          { title: "Test on phone and desktop and send feedback", client: true },
          { title: "Fix the feedback and retest" },
          { title: "Check page speed, security and backups" }
        ]
      },
      {
        title: "Launch and handover",
        description: "Go live, confirm everything works, and hand over access and documentation.",
        days: 49,
        tasks: [
          { title: "Point the domain and switch on SSL" },
          { title: "Run the go-live checklist" },
          { title: "Hand over logins and documentation" },
          { title: "Confirm sign-off", client: true }
        ]
      }
    ]
  },

  scale: {
    name: "Fix / scale",
    milestones: [
      {
        title: "Audit",
        description: "We find what is slow, failing or at risk, and measure it.",
        days: 7,
        tasks: [
          { title: "Give us access to the code, servers and monitoring", client: true },
          { title: "Review errors, slow requests and uptime history" },
          { title: "Review the server setup, backups and security" },
          { title: "Write up the findings with the fixes ranked by impact" }
        ]
      },
      {
        title: "Fixes",
        description: "The highest-impact problems are fixed first.",
        days: 21,
        tasks: [
          { title: "Fix the top-ranked problems" },
          { title: "Add monitoring and alerts for them" },
          { title: "Confirm the fixes with before and after numbers" }
        ]
      },
      {
        title: "Load testing and hardening",
        description: "We test it under real-world load and close the gaps.",
        days: 28,
        tasks: [
          { title: "Run load tests against the busiest paths" },
          { title: "Tune the database, caching and server size" },
          { title: "Test backup restore" }
        ]
      },
      {
        title: "Report and next steps",
        description: "A plain summary of what changed, the numbers, and what we recommend next.",
        days: 35,
        tasks: [
          { title: "Deliver the report" },
          { title: "Agree next steps", client: true }
        ]
      }
    ]
  },

  operate: {
    name: "Operate",
    milestones: [
      {
        title: "Onboarding",
        description: "We take over day-to-day running and set up monitoring.",
        days: 7,
        tasks: [
          { title: "Give us access to the site, hosting and domain", client: true },
          { title: "Record the current setup and take a first backup" },
          { title: "Set up uptime and security monitoring" },
          { title: "Agree who we contact and how fast we respond", client: true }
        ]
      },
      {
        title: "Monthly care",
        description: "Updates, backups and checks every month.",
        days: 30,
        tasks: [
          { title: "Apply updates and security patches" },
          { title: "Check a backup restores" },
          { title: "Review uptime, speed and security" },
          { title: "Send the monthly report" }
        ]
      }
    ]
  },

  ai: {
    name: "AI",
    milestones: [
      {
        title: "Use case and data",
        description: "We choose the one process to automate and check the data it will use.",
        days: 7,
        tasks: [
          { title: "Walk us through the process as it works today", client: true },
          { title: "Share sample data and the rules people follow", client: true },
          { title: "Define what a good result looks like, with a number" },
          { title: "Review the data for quality and privacy" }
        ]
      },
      {
        title: "Prototype",
        description: "A working version on real examples, so we can see how well it does.",
        days: 21,
        tasks: [
          { title: "Build the first version" },
          { title: "Run it on real examples and measure it" },
          { title: "Review the results together", client: true }
        ]
      },
      {
        title: "Integrate",
        description: "It is connected to the systems your team already uses.",
        days: 35,
        tasks: [
          { title: "Connect it to your systems" },
          { title: "Add a human review step where it matters" },
          { title: "Set limits, logging and cost controls" }
        ]
      },
      {
        title: "Roll out and monitor",
        description: "Launch to your team, then watch the results and the cost.",
        days: 49,
        tasks: [
          { title: "Train the team", client: true },
          { title: "Launch to the first group" },
          { title: "Review accuracy, cost and usage after two weeks" }
        ]
      }
    ]
  },

  advisory: {
    name: "Advisory",
    milestones: [
      {
        title: "Discovery",
        description: "We understand the business, the systems and the goal.",
        days: 7,
        tasks: [
          { title: "Hold the discovery sessions" },
          { title: "Share the documents and access we asked for", client: true }
        ]
      },
      {
        title: "Assessment",
        description: "What we found, measured against the goal.",
        days: 14,
        tasks: [{ title: "Review the systems and costs" }, { title: "Write up the assessment" }]
      },
      {
        title: "Recommendations",
        description: "What we recommend, in order, with the cost and the effect of each.",
        days: 21,
        tasks: [{ title: "Present the recommendations" }, { title: "Choose what to take forward", client: true }]
      }
    ]
  },

  exploring: {
    name: "Exploring",
    milestones: [
      {
        title: "Intro and scoping",
        description: "We learn what you need and tell you plainly whether we are a fit.",
        days: 7,
        tasks: [{ title: "Hold the intro call" }, { title: "Send the proposal and price" }, { title: "Confirm whether to go ahead", client: true }]
      }
    ]
  }
};

export const templateFor = (engagement: string | null | undefined): ProjectTemplate | null =>
  (engagement && PROJECT_TEMPLATES[engagement]) || null;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Add a template's milestones and tasks to a project, after any it already has. The first one
 * added starts as in progress when the project has no milestone running. Returns how many
 * milestones were added.
 */
export async function applyTemplate(workspaceId: string, template: ProjectTemplate, opts: { existingCount: number; hasActive: boolean; startDate?: Date }): Promise<number> {
  const start = opts.startDate ?? new Date();
  const db = consoleSchema();

  const { data: created, error } = await db
    .from("deliverables")
    .insert(
      template.milestones.map((m, i) => {
        const due = new Date(start);
        due.setUTCDate(due.getUTCDate() + m.days);
        return {
          workspace_id: workspaceId,
          title: m.title,
          description: m.description,
          status: i === 0 && !opts.hasActive ? "in-progress" : "not-started",
          sort_order: opts.existingCount + i,
          due_at: `${isoDay(due)}T00:00:00Z`
        };
      })
    )
    .select("id,sort_order");
  if (error) throw error;

  const idBySort = new Map((created ?? []).map((d) => [d.sort_order as number, d.id as string]));
  const tasks = template.milestones.flatMap((m, i) =>
    m.tasks.map((t, j) => ({
      deliverable_id: idBySort.get(opts.existingCount + i) as string,
      title: t.title,
      sort_order: j,
      owner: t.client ? "client" : "team"
    }))
  );
  if (tasks.length > 0) {
    const { error: taskError } = await db.from("deliverable_tasks").insert(tasks);
    if (taskError) throw taskError;
  }
  return template.milestones.length;
}
