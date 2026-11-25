# SOLVEX frontend foundation

The repository is an npm-workspaces monorepo. The runnable Next.js App Router frontend is in `apps/web`. The Express/Prisma API is in `apps/api`; the frontend has not yet been integrated with those endpoints.

## Frontend areas

- `apps/web/app/(public)` contains lightweight product information pages; `app/page.tsx` hosts the public landing page.
- `apps/web/app/(auth)` contains customer registration and customer, agent, and admin sign-in routes. Admin sign-up is intentionally not exposed.
- `apps/web/app/customer`, `app/agent`, and `app/admin` contain separate workspace route groups and role-specific layouts.
- `apps/web/components` contains landing, workspace, common, and layout UI. Shared workspace dashboards use mock data and reusable ticket tables, cards, charts, badges, and journey/SLA views.
- `apps/web/lib/mock-data.ts` is the isolated sample-data source. No frontend module connects to an API.
- `apps/web/hooks`, `apps/web/types`, and `apps/web/public` are extension points for later development.
- `apps/api/src` contains the API config, controllers, middleware, routes, services, Socket.IO handlers, utilities, and types. `apps/api/prisma` contains the PostgreSQL schema, seed, and initial migration.
- Root configuration holds npm workspaces, environment examples, and shared ignore rules. Existing project history and this README are retained.

## Sample behavior and access boundaries

Forms, filters, sorting, notification controls, assignment recommendations, and chart interactions operate on local demonstration data only. The frontend is not yet wired to live API data. Server-side authentication, role checks, and ticket ownership controls are implemented in the API and apply only when clients use those endpoints; frontend mock data is not protected or live.

## Run

From the repository root, run `npm install`, then `npm run dev`. The web app is served at `http://localhost:3000`. For production verification use `npm run build`; `npm run typecheck` and `npm run lint` check the frontend.
