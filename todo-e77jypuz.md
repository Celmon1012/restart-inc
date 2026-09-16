# Console Subpages Implementation Checklist

- [x] Extract reusable ConsoleNavbar/ConsoleLayout with active status pill, Start a Project CTA, and working user profile dropdown
- [x] Create ProfileSecurity page (`/console/profile`) with operator info, MFA, active sessions, and hardware key security
- [x] Create ConsoleSettings page (`/console/settings`) with pod preferences, telemetry refresh rate, notification triggers, and audit logging
- [x] Create ApiKeyVault page (`/console/keys`) with API keys table, create key modal/trigger, webhook secrets, and key rotation
- [x] Create BillingSla page (`/console/billing`) with SLA tier contract details, 99.99% uptime guarantee, committed <15m P1 response, invoices, and retainer details
- [x] Wire all 4 routes in `App.tsx` and update links in `Dashboard.tsx` dropdown menu
- [x] Add Obsidian dark CSS classes for the console subpages to maintain uniform aesthetics
- [x] Run TypeScript checks and production build
- [x] Verify pages visually with screenshots
- [x] Save checkpoint and push to GitHub repository (`adeusuf/restart-inc`)
