/**
 * The technologies we deploy on. Every entry is a real platform we ship
 * with -- not a decorative logo strip. Used by the homepage integration
 * wall and the Platform page.
 */
export const platformStack: { name: string; logo: string }[] = [
  { name: "Laravel", logo: "/logos/stacks/laravel.svg" },
  { name: "PostgreSQL", logo: "/logos/stacks/postgresql.svg" },
  { name: "Next.js", logo: "/logos/stacks/nextdotjs.svg" },
  { name: "Supabase", logo: "/logos/stacks/supabase.svg" },
  { name: "Medusa", logo: "/logos/stacks/medusa.svg" },
  { name: "Filament", logo: "/logos/stacks/filament.svg" },
  { name: "Claude API", logo: "/logos/stacks/anthropic.svg" },
  { name: "n8n", logo: "/logos/stacks/n8n.svg" },
  { name: "Chatwoot", logo: "/logos/stacks/chatwoot.svg" },
  { name: "Lago", logo: "/logos/stacks/lago.svg" },
  { name: "WhatsApp Business", logo: "/logos/stacks/whatsapp.svg" },
  { name: "PaperclipAI", logo: "/logos/stacks/paperclipai.svg" },
];

const TOOL_ALIASES: Record<string, string> = {
  octane: "Laravel",
  horizon: "Laravel",
  pgvector: "PostgreSQL",
  "admin api": "Medusa",
  whatsapp: "WhatsApp Business",
};

/** Logo for a tool or tag name, or undefined when it is not a tool we have a mark for. */
export function techLogo(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  const target = TOOL_ALIASES[key];
  if (target) return platformStack.find((p) => p.name === target)?.logo;
  return platformStack.find((p) => key.includes(p.name.toLowerCase().split(" ")[0]))?.logo;
}
