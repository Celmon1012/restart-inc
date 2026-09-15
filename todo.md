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

## Webhook connection, full case study outcome previews, transitions & GitHub push
- [x] Connect onboarding inquiry form to a mock webhook endpoint to simulate realistic HTTP submission, payload transmission, and success animation trigger
- [x] Populate remaining case study cards and outcome dossiers with complete realistic preview metrics and before/intervention/after outcomes
- [x] Add subtle smooth transition animations and keyframe crossfades to case-study hover reveals and outcome dossier switching
- [x] Run type-check and production build to verify zero regressions
- [x] Capture screenshots of the populated case study section and modal workflow
- [x] Push changes to GitHub using gh CLI and create webdev checkpoint

## Push to main branch in GitHub repo
- [x] Inspect remote github/main branch
- [x] Push current codebase directly to github main branch (adeusuf/restart-inc)
- [x] Verify remote GitHub repository state

## Hero proof row position and nav menu cleanup
- [x] Move hero checkmark proof row below the action buttons
- [x] Remove "SAAS SYSTEMS" nav link from header navigation
- [x] Validate layout with desktop and mobile screenshots
- [x] Save checkpoint and push update to GitHub repo main branch

## Remove VERIFIED OUTCOME ENGINE widget
- [x] Remove the metrics dashboard and outcome dossier widget from the Case Studies section
- [x] Clean up unused variables, icons, and CSS
- [x] Validate with screenshots and build checks
- [x] Save checkpoint and push to GitHub repository main

## Fix Coolify Deployment Error
- [x] Create nixpacks.toml specifying Node 22 and static output directory
- [x] Update build script in package.json to copy public assets into dist root for Caddy SPA server
- [x] Guard analytics script in client/index.html against missing deployment environment variables

## Case Study Write-Up Modal & Portfolio Page
- [x] Implement CaseStudyModal with detailed challenge, architecture, and outcomes write-ups
- [x] Connect homepage case study cards to trigger write-up modal on click
- [x] Add "View All Case Studies" button below the three cards in Home.tsx
- [x] Create dedicated /case-studies portfolio page with category filtering and modal integration
- [x] Configure routing in App.tsx for /case-studies
- [x] Test TypeScript compilation, build, and verify desktop/mobile screenshots
- [x] Save checkpoint and push updates directly to GitHub main branch

## Header CTA Update
- [x] Replace "Request Demo" with "Start a Project" in Home.tsx header
- [x] Replace "Request Demo" with "Start a Project" in CaseStudies.tsx header
- [x] Verify build and screenshots
- [x] Save checkpoint and push to GitHub repository main

## Premium Service Tiers & Budget Range Dropdown
- [x] Update Onboarding inquiry options to highlight premium service tiers (Dedicated Bare-Metal Cloud, Custom AI Agentic Systems, Shopify Plus Core, Multi-Tenant SaaS, Fractional CTO)
- [x] Add budget range dropdown field ($10k-$25k, $25k-$50k, $50k-$100k, $100k+) for lead qualification
- [x] Update webhook payload to include selected budget range

## Dedicated High-Conversion Squeeze Page
- [x] Build dedicated /start-project squeeze page with distraction-free layout, social proof dossier, and embedded high-converting inquiry workflow
- [x] Wire /start-project and /onboarding routes in App.tsx
- [x] Update header "Start a Project" CTAs to link to /start-project

## Typography Update: Increase Paragraph Font Sizes by 2px
- [x] Increase font-size by 2px across all body paragraphs in index.css (hero, section intros, lane cards, offer copies, case cards, saas copy, use cases, proof grid, faq answers, and footer)
- [x] Verify legibility and contrast across desktop and mobile
- [x] Run typecheck and production build
- [x] Save checkpoint and push directly to GitHub main branch

## Service Tier Dropdown, Button Layout & Hero Copy Update
- [x] Refactor Service Tier in inquiry form (StartProject.tsx and OnboardingModal.tsx) as a clean dropdown selector
- [x] Make "Submit Project Enquiry" button full width
- [x] Move "Confidential. Reviewed directly by senior engineering leadership." beneath the full-width submit button
- [x] Update Hero H1 to "Build for what’s next." (with brand highlight on "what’s next.")
- [x] Update Hero description to: "Restart Inc. gives serious operators the engineering expertise, automation, and production discipline to move bold product ideas faster— into reliable & scalable systems with confidence."
- [x] Run typecheck, build, and verify screenshots
- [x] Save checkpoint and push to GitHub main branch

## Refined Hero Copy Update
- [x] Update hero description in Home.tsx to: "Restart Inc. gives serious operators the engineering expertise, automation, and production discipline to move bold product ideas faster—and turn them into reliable systems that scale with confidence."
- [x] Verify build, screenshot, save checkpoint, and push to GitHub main branch

## Re-link All Inquiry Buttons to /start-project Squeeze Page
- [x] Audit all buttons previously triggering the modal in Home.tsx (header CTA, mobile nav CTA, hero CTA, offer CTAs, lane links, final CTA, footer links)
- [x] Update buttons in Home.tsx to route to /start-project (using wouter Link or navigate)
- [x] Update buttons in CaseStudies.tsx and CaseStudyModal.tsx to route to /start-project
- [x] Support pre-selecting matching Service Tier in StartProject.tsx when navigated with ?tier= query parameter
- [x] Test navigation, verify build and screenshots
- [x] Save checkpoint and push directly to GitHub main branch

## Site Description Update
- [x] Update hero description in Home.tsx: "Restart Inc. provides serious operators the engineering expertise, infrastructure, and production discipline to move bold product ideas faster—and turn them into reliable systems that scale with confidence."
- [x] Update meta description in client/index.html to match
- [x] Verify typecheck, build, and screenshots
- [x] Save checkpoint and push directly to GitHub main branch

## Mobile Site Optimization
- [x] Audit current mobile CSS (@media max-width: 900px and 700px)
- [x] Increase text size across mobile (headings, paragraphs to 15-16px, labels, card text, tags)
- [x] Add generous side margins/padding (20-24px gutters) to container, sections, and cards to avoid cramped edges
- [x] Make mobile offer boxes/columns have clear background, border, and distinct card styling
- [x] Optimize mobile spacing on case study cards, trust strip, and squeeze page
- [x] Verify with mobile screenshots at 375px and 414px viewports
- [x] Save checkpoint and push directly to GitHub main branch

## Four Disciplines Section Header Update
- [x] In Home.tsx, add <SectionLabel>FOUR DISCIPLINES</SectionLabel> above the header
- [x] Remove "Four lanes." from the H2 so it reads "Let's work together on any of them."
- [x] Ensure the H2 text is solid white (no teal span)
- [x] Verify build and screenshots
- [x] Save checkpoint and push directly to GitHub main branch

## Copy Updates: Site Description & Disciplines Subtitle
- [x] Update hero description in Home.tsx: "Restart Inc. is a technology and engineering firm that helps ambitious operators turn complex workflows and product ideas into reliable, scalable systems."
- [x] Update meta description in client/index.html to match
- [x] Update disciplines subtitle in Home.tsx: "We provide the expertise, infrastructure, and production discipline to move bold product ideas faster"
- [x] Verify build and screenshots
- [x] Save checkpoint and push directly to GitHub main branch

## Obsidian Black Theme Switch
- [x] Audit all blueish color tokens, backgrounds, and gradient definitions across index.css
- [x] Update CSS variables: `--bg: #050507;` / obsidian backdrops, `--border: rgba(255,255,255,0.08);`, obsidian graphite cards
- [x] Refactor hero glow, radial gradients, header glass, service lane cards, and offer boxes from blueish to obsidian dark graphite
- [x] Update CaseStudies page and /start-project squeeze page to obsidian black aesthetic
- [x] Maintain high-contrast brand teal (#2ee5c1) and crisp white typography
- [x] Expand page container width to at least 1300px (e.g. min(1320px, calc(100% - 64px))) for .container, .site-header, .hero-shell, and footer
- [x] Ensure wide viewport layout scales gracefully with the >=1300px canvas
- [x] Verify desktop and mobile screenshots
- [x] Save checkpoint and push directly to GitHub main branch

## Footer CTA Centralization & Button Copy
- [x] Update footer CTA button copy in Home.tsx from "Request Demo & Start Onboarding" to "Tell us what you’re building"
- [x] Centralize footer CTA text, headline, description, and button cluster using dedicated centered flex styling in index.css
- [x] Verify desktop and mobile layout with screenshots
- [x] Save checkpoint and push directly to GitHub main branch

## Typography & Integration Icons Scaling
- [x] Load DM Sans font in client/index.html alongside Plus Jakarta Sans
- [x] Update all paragraph (`p`) styles in index.css to use `font-family: "DM Sans", sans-serif;`
- [x] Set all H3 headings to `font-size: 20px;` across all cards, modals, and sections
- [x] Double the size of integration icons in Home.tsx and index.css (icon size from 18 to 36, enhanced padding and grid scaling)
- [x] Verify desktop and mobile layout with screenshots
- [x] Save checkpoint and push directly to GitHub main branch
