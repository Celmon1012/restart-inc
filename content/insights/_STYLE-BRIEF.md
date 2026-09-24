# Restart Insights — authoring brief

Every article in this directory must read as though written by the same senior engineer.
Follow this brief exactly; deviation is the main failure mode.

## Voice

Restart's voice is that of a **senior engineer explaining a decision to a peer who is paying for
judgement, not adjectives**. It is:

- **Direct and unhedged.** State the claim, then justify it. No "we believe", no "solutions that
  empower businesses to unlock value".
- **Concrete before abstract.** Lead with the specific mechanism, number, or failure mode. The
  general principle earns its place only after the concrete case has established it.
- **Comfortable saying what is hard.** Constraints, trade-offs, and things that cannot be fixed
  cheaply. Sections that admit difficulty are more persuasive than sections that promise outcomes.
- **Calm about cost.** Money, latency, and maintenance burden are engineering variables, not
  pleasant surprises. Name them without apology.
- **Free of marketing register.** Banned phrases: "empower", "unlock", "seamless", "cutting-edge",
  "best-in-class", "leverage" (as a verb), "journey", "robust solution", "digital transformation",
  "in today's fast-paced world", "game-changing".
- **Never fabricates.** Do not invent client names, testimonials, or metrics. All figures used must
  come from `client/src/data/caseStudies.ts`, which you must read first. Where a case study is
  anonymised ("a global logistics firm"), keep it anonymised in exactly that register — the site
  deliberately does not name clients.

## Structure

Every article follows this shape:

1. **Opening (2–3 short paragraphs, no heading).** Start inside a specific situation — a decision
   being made under pressure, or a failure mode being discovered. Do not start with a definition,
   a thesis statement, or throat-clearing. The reader should be able to picture the scene.
2. **Three to five `##` sections.** Each must carry a real idea, not a restatement. Prefer section
   headings that make a claim ("Latency and cost share one budget") over neutral labels
   ("Considerations").
3. **At least one `###` subsection** where a mechanism needs closer explanation.
4. **Concrete detail throughout.** Numbers, order-of-magnitude reasoning, named technologies,
   specific failure modes. Where you use a figure, attribute it to what it actually was.
5. **A closing section that gives the reader something to do.** Something they can check in their
   own system this week. Not a summary, not a call to action.

## Length and formatting

- **800–1,100 words.** This is a considered piece, not a manifesto.
- Markdown only. `##` and `###` headings, `-` lists, `> ` blockquotes for a single memorable line,
  and fenced code blocks where a mechanism is best shown as a fragment of SQL, config, or schema.
- Use **bold** sparingly, for the one phrase in a paragraph that carries the argument.
- No tables unless comparing three or more parallel options.
- No emoji. No exclamation marks.
- Use `–` (en dash) for ranges and `—` (em dash) for asides.

## Technical standard

Assume the reader is a competent engineer or a technical founder. They know what a webhook is and
what a queue does. Do not explain basic concepts. **Do** explain the non-obvious consequence: why
idempotency keys must be stored before the side effect, why schema-per-tenant and row-level tenancy
diverge at a specific scale, why hybrid retrieval beats pure vector search on the queries that
matter.

Every mechanism you describe must be one you could defend in an architecture review. Do not
recommend something because it is fashionable.

## Code fragments

Where included, keep them under ~15 lines, and make them the kind of fragment that carries the
insight — an index definition, a uniqueness constraint, a retry-guard condition. Add one or two
lines of prose explaining what the fragment demonstrates. Never include a large implementation.

## Grounding requirement

Before writing, read `client/src/data/caseStudies.ts`. Each article is assigned one or two case
studies in its task brief; use their `challenge`, `solution`, `results`, and `stack` fields as the
factual spine. You may reference the *situation* of an engagement; you may not claim the engagement
turned out differently than the file records.

## Final check before saving

- Does the opening put the reader in a specific situation within three sentences?
- Is every number traceable to the case study file?
- Would a senior engineer find anything here they did not already know?
- Is every "empower/unlock/seamless" class of word gone?
- Does the closing give a concrete action rather than a summary?
