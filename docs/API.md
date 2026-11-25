# SOLVEX API

The backend is an Express 5 API in `apps/api`, using TypeScript, PostgreSQL, Prisma, Zod, bcrypt, HTTP-only cookie sessions, and Socket.IO. It is independently runnable from the root npm workspace. The Next.js frontend still uses mock data and is not connected to these endpoints.

## PostgreSQL setup

Start Docker Desktop, then configure the repository-root `.env` with a private local password for `POSTGRES_PASSWORD`. Set the password portion of `DATABASE_URL` to the same value; the root `.env.example` shows the expected format:

```dotenv
POSTGRES_PASSWORD=<your-local-password>
DATABASE_URL=postgresql://solvex:<your-local-password>@localhost:5432/solvex?schema=public
```

Do not overwrite an existing `.env` or commit it. The root `.env` is used by Docker Compose and is also a fallback for the API and Prisma CLI. If the password contains URL-reserved characters, percent-encode them in `DATABASE_URL`. `DATABASE_URL` remains required; validation is not bypassed and the API does not use a fake or in-memory database.

Start and check the database from the repository root:

```powershell
docker compose up -d postgres
docker compose ps
```

`db:generate` and Prisma schema-only commands (`validate`, `format`) do not connect to PostgreSQL. If no real URL is configured, Prisma reads the placeholder from `apps/api/.env.example` for those commands only and prints a warning. Express startup, migrations, and seeding still require a real `DATABASE_URL`.

## Initialize and run

From the repository root:

```powershell
npm install
docker compose up -d postgres
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev:api
```

Run the focused backend unit tests with `npm run test:api`.

The checked-in initial migration is generated from `apps/api/prisma/schema.prisma`. `db:deploy` applies existing migrations; `db:migrate` is for local schema development and creates/applies migrations. The seed provisions default SLA policies. It creates an administrator only when all three optional `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, and `SEED_ADMIN_PASSWORD` values are set; use a unique local password of at least 12 characters. Public admin and agent registration are not available.

The API listens on `http://localhost:4000`. `GET /api/health` returns HTTP 200 when PostgreSQL is reachable and HTTP 503 with a degraded status when it is not.

Useful root scripts:

```powershell
npm run typecheck:api
npm run build:api
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
```

## Route groups

All routes are under `/api`. Authenticated requests use the `solvex.sid` HTTP-only cookie by default; configure `SESSION_COOKIE_NAME`, `SESSION_TTL_HOURS`, and `FRONTEND_URL` in the environment. The API continues to accept the older `WEB_ORIGIN` setting as a fallback.

| Route group | Main endpoints | Access |
| --- | --- | --- |
| `/auth` | `POST /register`, role-specific `POST /customer/login`, `/agent/login`, `/admin/login`, `POST /logout`, `GET /me`, `PATCH /me` | Public registration is customer-only |
| `/users` | `GET /`, `GET /customers`, `GET /:userId`, `POST /agents`, `PATCH /:userId/status` | Admin |
| `/tickets` | `GET /`, `POST /`, `GET /assigned`, `GET /unassigned`, `GET /:ticketId`, `PATCH /:ticketId`, `PATCH /:ticketId/status`, `GET /:ticketId/history`, attachment upload/download, feedback, customer resolution confirmation, similar-ticket and resolution-memory endpoints | Role- and ticket-scoped |
| `/assignments` | Assign/reassign, agent claim, escalation, and recommendations | Admin assigns/recommends; agents claim/escalate |
| `/messages` | Public message history/replies and `/internal-notes` | Ticket-scoped; private notes require agent/admin |
| `/sla` | Risk list, per-ticket risk, policy list/upsert | Agent/admin risks; admin policy management |
| `/notifications` | List, mark one read/unread, mark all read | Authenticated user’s own notifications |
| `/incidents` | List, create group, review group | Agent/admin with ticket access |
| `/analytics` | `GET /` with optional `from` and `to` ISO dates | Agent/admin; agent metrics are limited to assigned tickets |

Every request body, query, and route parameter is validated. Unauthorized or inaccessible tickets are not returned to customers or agents. Internal notes use a separate table and are excluded from customer responses and socket events.

## SLA, Issue DNA, and real-time events

- The SLA monitor runs once at startup and then every minute. Rules use configured deadlines, priority, age, and current assigned-agent load; the returned risk factors and recommendations are explainable heuristics, not guaranteed AI predictions.
- Issue DNA uses normalized-token Jaccard similarity, plus category/domain signals. Agent results are restricted to assigned and skill-authorized unassigned tickets.
- Resolution Memory ranks approved saved solutions from resolved tickets.
- Fairness recommendations rank agents by matching skill, urgent workload, active workload, and ticket complexity; recommendations do not assign automatically.
- No-Silence alerts use the ticket’s last recorded update time and configured policy interval. Alerts do not generate fake progress updates.
- Socket.IO authenticates the same session cookie. Clients request access to a ticket room with `ticket:join` and are authorized against the database. Server events include `ticket:new`, `ticket:assigned`, `ticket:message`, `ticket:status`, `sla:warning`, and `notification:new`. Private internal-note content is never broadcast.

## Operational notes

- Attachments are limited to 10 MiB and PNG/JPEG/PDF content. Files are stored under the configured private `UPLOAD_DIR`; only authorized ticket endpoints serve them. Configure persistent private storage before deployment.
- The backend uses in-app database notifications; email delivery is not configured.
- The implementation uses one Socket.IO process and the default in-memory adapter. Use a shared adapter and persistent shared file storage before horizontal scaling.
- A real PostgreSQL instance is required to exercise migrations, seed data, and database-backed API workflows. Type checking, production compilation, Prisma validation/client generation, and HTTP health/error smoke checks can run without one.
