# CaFair — Full-Stack Starter Template

A monorepo starter with theming, auth, dual APIs, database, and an LLM prompt service — ready to build on.

## Stack

- **Web Client**: Next.js 16 + TypeScript + tRPC + Hono + Drizzle ORM + Clerk Auth + Tailwind CSS v4 + shadcn/ui
- **LLM Service**: Express + TypeScript + Google Gemini AI + Redis
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Theme Engine**: 20+ presets, live editor, Zustand store, View Transitions API

## Project Structure

```
cafair/
├── apps/
│   ├── web-client/          # Next.js frontend + API layer
│   └── llm/                 # Express LLM prompt microservice
├── supabase/
│   ├── config.toml          # Supabase configuration
│   └── migrations/          # SQL migrations (Drizzle Kit)
├── ARCHITECTURE.md          # System architecture diagrams
├── SYSTEM_DESIGN.md         # Developer guide
└── package.json             # npm workspaces root
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for Supabase local dev & LLM Redis)
- npm

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
# Web client
cp apps/web-client/.env.example apps/web-client/.env

# LLM service
cp apps/llm/.env.example apps/llm/.env
```

Required keys:

- `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

### 3. Start Supabase (Local)

```bash
npm run supa:start
```

### 4. Run Database Migrations

```bash
npm run db:migrate
```

### 5. Start Development Servers

```bash
# Web client (Next.js :3000)
npm run dev:web

# LLM service (Express :3001)
npm run dev:llm
```

## Available Scripts

| Script        | Description                     |
| ------------- | ------------------------------- |
| `dev:web`     | Start web client dev server     |
| `build:web`   | Build web client for production |
| `dev:llm`     | Start LLM service dev server    |
| `build:llm`   | Build LLM service               |
| `db:generate` | Generate Drizzle migrations     |
| `db:migrate`  | Run database migrations         |
| `db:push`     | Push schema changes (dev only)  |
| `db:studio`   | Open Drizzle Studio             |
| `supa:start`  | Start local Supabase            |
| `supa:stop`   | Stop local Supabase             |

## Documentation

| Doc                            | What it covers                           |
| ------------------------------ | ---------------------------------------- |
| `ARCHITECTURE.md`              | System diagrams, data flows, port map    |
| `SYSTEM_DESIGN.md`             | Developer guide — adding services & APIs |
| `apps/llm/README.md`           | LLM service API, templates, Docker setup |
| `src/docs/TRPC_USAGE_GUIDE.md` | tRPC + TanStack Query patterns           |
| `src/docs/MOBILE_CLIENT.md`    | Hono REST API for mobile clients         |
| `src/services/theme/README.md` | Theme engine setup & customization       |

## Auth Flow

1. User signs in via **Clerk**
2. Clerk JWT is injected into Supabase via `secure-client.ts`
3. **RLS policies** enforce per-user data isolation using `auth.user_id()`

## Adding New Features

See `SYSTEM_DESIGN.md` for step-by-step instructions covering:

- Creating a new service module
- Defining Drizzle schemas
- Adding tRPC procedures
- Adding Hono REST endpoints
- Running migrations

## License

MIT
