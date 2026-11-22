# FinScope progress

Updated: 2026-11-22

## Implemented

- Independent Next.js / TypeScript / PostgreSQL / Prisma application.
- Password auth, hashed sessions, CSRF checks, rate limits and server-side workspace authorization.
- Isolated, expiring synthetic demo with a scoped reset and authenticated cleanup endpoint.
- Accounts, exact decimal ledger, manual transactions, filtering and cursor pagination.
- Reviewable browser-local CSV/PDF parsing, column mappings, exclusions, idempotent atomic imports, duplicate detection, acknowledged balance warnings and import undo.
- Dated conversion, real historical reference-rate provider with manual fallback, explicit reconciliation and audit records.
- Interactive cash flow/category views, budget alerts, savings goals, recurring detection, forecasts and optional aggregate AI summaries.
- Responsive premium identity, theme switch, command palette, empty/error/loading states and accessible dialogs.
- SQL migration, standalone PostgreSQL compose service, CI, documentation and synthetic-data automated tests.

## Verification

Executed successfully on 2026-11-22:

- Dependency installation and frozen lockfile verification: passed.
- PostgreSQL migrations: applied to independent development and test databases.
- TypeScript, ESLint and formatting: passed.
- Unit / real PostgreSQL integration tests: **10 passed**, including atomic rollback, overlapping imports, concurrent idempotency, concurrent goal updates, workspace authorization and session expiry.
- Production Next.js build: passed.
- E2E: **14 passed** against the production server, covering desktop Chrome and iPhone-sized WebKit. Flows include navigation, command palette, themes, account/transaction persistence, search/edit/delete/export, CSV and PDF import/undo, duplicate prevention, budgets, goals, forecasts, signup/login/logout, CSRF, tenant isolation and demo reset.
- Synthetic desktop/mobile screenshots captured and inspected.
- Real Frankfurter historical-rate endpoint: HTTP success, reference date and quote returned.
- Dependency audit: **failing**; known high/critical advisories remain. Recommended patched versions were requested explicitly and returned registry 404 responses.

Chromium mobile pointer checks exposed the documented Playwright visual-viewport issue https://github.com/microsoft/playwright/issues/44121. Mobile critical flows are verified in WebKit without forced clicks or skipped tests. Authenticated link prefetch was disabled to avoid unnecessary session-bound requests and aborted-request errors in Safari.

Self-review fixed validator exceptions on malformed amounts, source-preserving transaction classification, accessible field names, compact sidebar overflow, mobile input sizing/touch targets and a too-broad local-origin cookie check.

## Known release blockers

- Recommended security patches for Next.js and other dependencies return 404 from the current registry. Audit is not clean. No public deployment is authorized at this stage.
- External AI provider requires an explicit API credential; the core demo and rule-based insights work without it.
- Managed database, hosting login and deployed-origin checks are deferred until all products are built and tested.

## Next steps

1. Publish and independently verify the public personal repository under liferacer23.
2. Continue to SprintOS, then PulseOps, FlowForge, QuantDesk and Roamly.
3. Resolve the documented security-release blockers before hosting.
4. Hold all deployments for the owner’s later instruction.
