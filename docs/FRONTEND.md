# SOLVEX frontend foundation

The repository is an npm-workspaces monorepo. The runnable Next.js App Router frontend is in `apps/web`; `apps/api` contains only the requested backend preparation structure and does not implement APIs, persistence, authentication, or real-time connections.

## Frontend areas

- `apps/web/app/(public)` contains lightweight product information pages; `app/page.tsx` hosts the public landing page.
- `apps/web/app/(auth)` contains customer registration and customer, agent, and admin sign-in routes. Admin sign-up is intentionally not exposed.
- `apps/web/app/customer`, `app/agent`, and `app/admin` contain separate workspace route groups and role-specific layouts.
- `apps/web/components` contains landing, workspace, common, and layout UI. Shared workspace dashboards use mock data and reusable ticket tables, cards, charts, badges, and journey/SLA views.
- `apps/web/lib/mock-data.ts` is the isolated sample-data source. No frontend module connects to an API.
- `apps/web/hooks`, `apps/web/types`, and `apps/web/public` are extension points for later development.
- `apps/api/src` is arranged for future config, controllers, middleware, routes, services, sockets, utilities, and types. `apps/api/prisma` is reserved for later database work; no schema has been added.
- Root configuration holds npm workspaces, environment examples, and shared ignore rules. Existing project history and this README are retained.

## Sample behavior and access boundaries

Forms, filters, sorting, notification controls, assignment recommendations, and chart interactions operate on local demonstration data only. Authentication, ticket ownership enforcement, SLA predictions, and role permissions must be implemented and enforced by the future backend; this UI does not claim to secure data or provide live monitoring.

## Run

From the repository root, run `npm install`, then `npm run dev`. The web app is served at `http://localhost:3000`. For production verification use `npm run build`; `npm run typecheck` and `npm run lint` check the frontend.
