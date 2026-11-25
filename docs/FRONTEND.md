# SOLVEX frontend and API integration

The Next.js App Router frontend is in `apps/web`; the Express/Prisma API is in `apps/api`. The frontend uses the existing API and Prisma models. No API routes or database models were added for the integration.

## API configuration and sessions

`apps/web/.env.local` sets `NEXT_PUBLIC_API_URL=http://localhost:4000/api` for local development. The shared client in `apps/web/lib/api.ts` sends requests with `credentials: "include"`, parses the API response envelope, and surfaces HTTP and validation errors. The browser does not persist passwords or session tokens; authenticated sessions use the API's HTTP-only cookie.

The auth screens call the existing customer registration and customer, agent, and admin login routes. Agent and admin registration are not public. Workspace layouts check `/auth/me`, redirect unauthenticated or wrong-role users, and call the logout route. Password reset is not available in the existing API.

## Connected workflows

- Customer ticket creation, paginated ticket lists/details, messages, attachments, ticket history, feedback, and profile use existing API routes. Customer ticket visibility is enforced by the API.
- Agent assigned/unassigned queues, ticket details, public replies, internal notes, status updates, SLA risk, and per-ticket resolution suggestions use existing routes. Internal notes are requested only from staff views; the API controls access and filtering.
- Notifications, incident-group review, customer/agent account management, admin-only agent provisioning, ticket-assignment recommendations and assignment, SLA policy editing, and analytics use existing API routes.
- Analytics and feature panels display unavailable states where the API has no corresponding data (for example, time-series charts and a calculated fairness score). Workspace settings and password reset remain unavailable because the API has no persistence or reset endpoint.

Some shared visual components and public marketing content still contain demonstration data. Do not treat those views as API-backed. In particular, time-series trends, agent fairness scores, and predictive AI output are not fabricated as live metrics.

## Run and verify

From the repository root, run these in separate terminals if the services are not already running:

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
```

The API is expected at `http://localhost:4000`; the web app is at `http://localhost:3000`. To check the frontend types and lint:

```powershell
npm.cmd run typecheck
npm.cmd run lint
```

Authenticated end-to-end testing requires valid customer, agent, and admin accounts. Do not create or alter production accounts solely for testing. A production Next.js build should not be run against the same `.next` directory while the development server is running.
