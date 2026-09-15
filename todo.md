# Restart homepage enhancement checklist

- [x] Inspect the supplied long reference screenshot in readable crops and note its layout, sections, spacing, and interaction patterns.
- [x] Inspect the current homepage implementation and identify reusable brand/style primitives.
- [x] Preserve the existing dark navy palette, technical editorial tone, logo treatment, and current service language.
- [x] Rework the homepage structure to strengthen hero hierarchy, service lanes, productized offers, proof sections, content blocks, FAQ, and footer CTA.
- [x] Add responsive behavior and restrained engineering-style motion without changing the brand theme.
- [x] Validate the homepage on desktop and mobile with screenshots and run the production check/build.
- [x] Save a checkpoint after validation and deliver the updated project.

## Reference findings

The supplied reference is a long dark, navy-first homepage with a compact top nav, centered hero, teal accent on key words, a subtle vertical beam/grid background, and wide breathing room between sections. It uses repeated rounded dark cards for four service lanes, then alternating two-column productized offer sections with compact feature lists, calendar/chart/donut/diagram visuals, an integration logo wall, a SaaS feature block, practical use cases, testimonials, blog cards, FAQ accordions, a final credibility CTA, and a dense multi-column footer. The overall tone is technical and premium, but approachable rather than corporate. The user explicitly asked to preserve this existing brand/style/theme.

The live page confirms the same current language: “Engineering Growth Systems for Serious Operators,” “Powering Experience,” four lanes for Laravel SaaS, Shopify Plus Apps, AI Engineering, and Architecture & Leadership, productized offers including MVP Build, AI Integration Sprint, Shopify Plus App, and Architecture Audit, plus existing pages/labels for Platform, Solutions, Case Studies, Insights, About, Log In, and Request Demo. The live page still contains placeholder Lorem ipsum in the integration/SaaS feature sections and generic footer contact details, so the enhancement should retain the structure but replace weak filler copy with Restart-specific language.

## Requested enhancement tasks

- [x] Rewrite the hero copy around business outcomes, urgency, and a clearer next action while keeping the existing Restart voice.
- [x] Add richer hover/focus interactions to service lane cards, including visual lift, accent reveal, and quick-scan affordances.
- [x] Add richer hover/focus interactions to productized offer sections, including visual movement and scope emphasis.
- [x] Create a dedicated case-studies section with a reusable structure for verified client context, measurable outcomes, and delivery detail; do not invent client names, testimonials, or metrics.
- [x] Validate the updated homepage at desktop and mobile sizes and run type-check/build.
- [x] Save a checkpoint and deliver the updated project.

## Interactive onboarding, case-study metrics, and navigation tasks
- [x] Inspect current Home.tsx and index.css after git fast-forward
- [x] Connect interactive inquiry forms to an onboarding workflow modal with scope selectors, budget/timeline, and a smooth animated success state
- [x] Build a dynamic case-study metrics grid that reveals detailed client outcomes and before/after context on hover/focus
- [x] Enhance sticky glass navigation with smooth scroll-to-section behavior and active section indicator (scrollspy)
- [x] Test with TypeScript check and production build
- [x] Visually verify via webdev_take_screenshot
- [x] Save checkpoint and push changes to origin

## Restore original style, CSS, and fonts while keeping new structure intact
- [x] Inspect git history to see the original index.css, index.html fonts, and typography rules in earlier checkpoints
- [x] Remove serif/editorial typography override and restore original sans-serif fonts and font imports
- [x] Align CSS classes and styling with the original repository look and feel
- [x] Keep all new features (onboarding modal, outcome metrics grid, scrollspy navigation, etc.) intact
- [x] Test TypeScript and build
- [x] Verify with desktop and mobile screenshots
- [x] Save checkpoint to origin
