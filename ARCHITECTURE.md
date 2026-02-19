# System Architecture

> How **tRPC · Hono · Drizzle · Supabase · LLM · Redis · Gemini** interact.

---

## High-Level Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│                                                                              │
│   ┌─────────────┐      ┌──────────────┐      ┌─────────────────────┐        │
│   │  Web Client  │      │ Mobile Client │      │  External Service   │        │
│   │  (Next.js)   │      │ (iOS/Android) │      │  (3rd-party API)    │        │
│   └──────┬───┬──┘      └──────┬───────┘      └──────────┬──────────┘        │
│          │   │                │                          │                    │
│     tRPC │   │ fetch     Hono │ REST (JSON)         HTTP │                    │
│          │   │                │                          │                    │
└──────────┼───┼────────────────┼──────────────────────────┼───────────────────┘
           │   │                │                          │
           ▼   ▼                ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         WEB-CLIENT (Next.js :3000)                           │
│                                                                              │
│  ┌──────────────────────┐  ┌───────────────────────────────────────┐         │
│  │  Clerk Middleware     │  │  Next.js API Routes                   │         │
│  │  (proxy.ts)           │  │                                       │         │
│  │                       │  │  /api/trpc/*  →  tRPC Fetch Adapter   │         │
│  │  • Auth guard         │──│  /api/hono/*  →  Hono REST Adapter    │         │
│  │  • JWT injection      │  │  /api/health  →  Hono health check    │         │
│  │  • Route matching     │  │                                       │         │
│  └──────────────────────┘  └──────────┬──────────────┬─────────────┘         │
│                                       │              │                       │
│                                  tRPC │         Hono │                       │
│                                       ▼              ▼                       │
│              ┌─────────────────────────────────────────────────────┐         │
│              │              SERVER LAYER                            │         │
│              │                                                     │         │
│              │  ┌─────────────────┐    ┌────────────────────┐      │         │
│              │  │  tRPC Router     │    │  Hono Router        │      │         │
│              │  │                  │    │                     │      │         │
│              │  │  • hello         │    │  GET  /health       │      │         │
│              │  │  • protectedHello│    │  GET  /users/:id    │      │         │
│              │  │  • users.*       │    │  POST /uploads/file │      │         │
│              │  │  • examples.*    │    │  GET  /examples     │      │         │
│              │  │  • uploads.*     │    │  ...REST endpoints   │      │         │
│              │  └────────┬────────┘    └─────────┬──────────┘      │         │
│              │           │                       │                  │         │
│              │           └──────────┬────────────┘                  │         │
│              │                      │                               │         │
│              │                      ▼                               │         │
│              │           ┌─────────────────────┐                   │         │
│              │           │   Drizzle ORM        │                   │         │
│              │           │                      │                   │         │
│              │           │  • Type-safe queries  │                   │         │
│              │           │  • Schema definitions │                   │         │
│              │           │  • RLS transactions   │                   │         │
│              │           └──────────┬───────────┘                   │         │
│              │                      │                               │         │
│              └──────────────────────┼───────────────────────────────┘         │
│                                     │ SQL (Postgres wire protocol)            │
└─────────────────────────────────────┼────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (Postgres :5432)                            │
│                                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐      │
│   │  users table  │  │ examples tbl │  │  Row Level Security (RLS)    │      │
│   │              │  │              │  │                              │      │
│   │  id, name,   │  │  id, data,   │  │  • JWT claims via Clerk      │      │
│   │  email, ...  │  │  user_id     │  │  • set_config('request.jwt') │      │
│   └──────────────┘  └──────────────┘  │  • Per-user data isolation   │      │
│                                       └──────────────────────────────┘      │
│   Migrations managed by Drizzle Kit → supabase/migrations/                  │
└──────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                         LLM SERVICE (Express :3001)                          │
│                                                                              │
│   ┌──────────────────────┐     ┌─────────────────────────────────┐          │
│   │  POST /api/prompt/run │     │  Prompt Formatter               │          │
│   │  POST /api/prompt/raw │────▶│                                 │          │
│   │  GET  /api/prompt/    │     │  • Role, Task, Rules, Input     │          │
│   │       templates       │     │  • Deterministic structure      │          │
│   │  GET  /api/health     │     │  • Template registry (6 built-in)│          │
│   └──────────────────────┘     └──────────┬──────────────────────┘          │
│                                           │                                  │
│                           ┌───────────────┼────────────────┐                │
│                           │               │                │                │
│                           ▼               ▼                │                │
│                ┌─────────────────┐  ┌────────────┐         │                │
│                │  Redis :6379     │  │  Gemini AI  │         │                │
│                │  (optional cache)│  │  2.0 Flash  │         │                │
│                │                 │  │             │         │                │
│                │  • SHA-256 key  │  │  • Text gen  │         │                │
│                │  • TTL eviction │  │  • JSON gen  │         │                │
│                │  • 128MB cap    │  │  • 4096 tok  │         │                │
│                └─────────────────┘  └─────────────┘         │                │
│                        ▲                    │               │                │
│                        │                    │               │                │
│                        └────────────────────┘               │                │
│                         cache miss → call Gemini            │                │
│                         cache hit  → skip Gemini            │                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow — Web Client (tRPC)

```
   Browser (React)
       │
       │  useTRPC().users.getMe.useQuery()
       │
       ▼
   tRPC Client (httpBatchLink)
       │
       │  POST /api/trpc/users.getMe   ← batched, superjson-encoded
       │
       ▼
   Clerk Middleware (proxy.ts)
       │
       │  • Validates session cookie / Bearer token
       │  • Injects auth context
       │
       ▼
   tRPC Fetch Adapter (route.ts)
       │
       │  createTRPCContext()
       │  • Resolves currentUser() via Clerk
       │  • Creates secureDb with Clerk→Supabase JWT
       │
       ▼
   tRPC Router → authedProcedure
       │
       │  ctx.secureDb.rls(tx => tx.select().from(users)...)
       │
       ▼
   Drizzle ORM
       │
       │  SET request.jwt.claims = '<clerk-jwt>'
       │  SELECT * FROM users WHERE id = $1
       │
       ▼
   Supabase Postgres (RLS enforced)
       │
       │  Row-level security checks JWT claims
       │  Returns only rows matching the user
       │
       ▼
   Response bubbles back up: Postgres → Drizzle → tRPC → superjson → React
```

---

## Data Flow — Mobile / REST Client (Hono)

```
   Mobile App (Swift / Kotlin / React Native)
       │
       │  GET /api/hono/users/me
       │  Authorization: Bearer <clerk-session-token>
       │
       ▼
   Clerk Middleware (proxy.ts)
       │
       │  • Validates Bearer token
       │  • Passes through to Hono
       │
       ▼
   Hono Router
       │
       │  clerkMiddleware()  →  getAuth(c)  →  userId
       │
       │  Internally calls the SAME Drizzle/Supabase layer:
       │  ┌────────────────────────────────────────────────┐
       │  │  const secureDb = await getSecureDb({ token }) │
       │  │  const user = await secureDb.rls(tx =>         │
       │  │    tx.select().from(users).where(...)          │
       │  │  )                                             │
       │  └────────────────────────────────────────────────┘
       │
       ▼
   Drizzle → Supabase (same RLS path as tRPC)
       │
       ▼
   JSON response → Client
```

### Why Hono for Mobile?

| Concern           | tRPC                                 | Hono (REST)                           |
| ----------------- | ------------------------------------ | ------------------------------------- |
| Type safety       | ✅ End-to-end (TS only)              | ✅ Zod validation on server           |
| Mobile clients    | ❌ Needs TS codegen / custom adapter | ✅ Standard JSON REST — any language  |
| Middleware         | ✅ tRPC middleware                    | ✅ Hono middleware (CORS, auth, etc.) |
| Performance        | ✅ Batched calls                      | ✅ Lightweight, edge-ready            |

---

## Adding New API Routes

### tRPC (web clients)

1. Create `services/<name>/procedures/index.ts` with your router
2. Register in `server/routers/app.ts`
3. Use via `useTRPC().<name>.<procedure>.queryOptions()`

### Hono (REST clients)

1. Create `server/hono/routes/<name>.ts` with Hono routes
2. Mount in `server/hono/app.ts`
3. Consume via standard HTTP requests

Both API layers share the same Drizzle DB layer and Clerk auth context.

---

## Data Flow — AI Prompt (LLM Service)

```
   Any Client (Web, Mobile, or Server-Side)
       │
       │  POST http://llm:3001/api/prompt/run
       │  { "template": "generate-theme-palette",
       │    "input": { "mood": "warm" },
       │    "parseJson": true, "cache": true }
       │
       ▼
   Express (LLM Service :3001)
       │
       │  Zod validates request body
       │  Prompt Formatter builds deterministic prompt string
       │
       ▼
   Redis Cache Check
       │
       ├── HIT  → return cached response (< 1ms)
       │
       └── MISS → call Gemini
                     │
                     │  POST generativelanguage.googleapis.com
                     │  model: gemini-2.5-flash
                     │  prompt: <formatted string>
                     │
                     ▼
                  Gemini Response
                     │
                     │  Strip markdown fences
                     │  JSON.parse if parseJson=true
                     │
                     ├── Store in Redis (TTL: 3600s)
                     │
                     ▼
                  Return to client
                  { data: {...}, meta: { cached: false, durationMs: 1200 } }
```

---

## Full System — All Services Together

```
┌───────────┐  ┌───────────────┐  ┌───────────────────┐
│   Web     │  │    Mobile     │  │   External /       │
│  Client   │  │    Client     │  │   Webhook caller   │
│  (React)  │  │  (Swift/RN)   │  │                    │
└─────┬─────┘  └──────┬────────┘  └────────┬───────────┘
      │               │                    │
      │ tRPC          │ REST (Hono)        │ REST (Hono)
      │               │                    │
      ▼               ▼                    ▼
┌─────────────────────────────────────────────────────┐
│               Next.js App (:3000)                    │
│                                                      │
│   ┌─────────┐   ┌─────────┐   ┌──────────────────┐ │
│   │  Clerk  │   │  tRPC   │   │      Hono        │ │
│   │  Auth   │──▶│ Router  │   │   REST Router    │ │
│   │         │   │         │   │                  │ │
│   └─────────┘   └────┬────┘   └───────┬──────────┘ │
│                      │                │             │
│                      └────────┬───────┘             │
│                               │                     │
│                        ┌──────▼──────┐              │
│                        │ Drizzle ORM │              │
│                        └──────┬──────┘              │
│                               │                     │
│                     ┌─────────▼──────────┐          │
│                     │  Secure Client     │          │
│                     │  (RLS via Clerk    │          │
│                     │   Supabase JWT)    │          │
│                     └─────────┬──────────┘          │
│                               │                     │
│        ┌──────────────────────┼───────────────┐     │
│        │ Server-side calls    │               │     │
│        │ to LLM service       │               │     │
│        ▼                      │               │     │
│  ┌──────────────┐             │               │     │
│  │ fetch() to   │             │               │     │
│  │ llm:3001     │             │               │     │
│  └──────┬───────┘             │               │     │
│         │                     │               │     │
└─────────┼─────────────────────┼───────────────┼─────┘
          │                     │               │
          ▼                     ▼               │
┌──────────────────┐  ┌──────────────────┐      │
│  LLM Service     │  │  Supabase        │      │
│  (Express :3001) │  │  (Postgres :5432)│◀─────┘
│                  │  │                  │
│  ┌────────────┐  │  │  • users         │
│  │ Prompt     │  │  │  • examples      │
│  │ Formatter  │  │  │  • RLS policies  │
│  └─────┬──────┘  │  │  • Migrations    │
│        │         │  │    (Drizzle Kit) │
│   ┌────▼────┐    │  └──────────────────┘
│   │ Redis   │    │
│   │ :6379   │    │
│   │ (cache) │    │
│   └─────────┘    │
│        │         │
│   ┌────▼────┐    │
│   │ Gemini  │    │
│   │ 2.0     │    │
│   │ Flash   │    │
│   └─────────┘    │
└──────────────────┘
```

---

## Service Responsibility Matrix

| Layer          | Technology       | Responsibility                                                  |
| -------------- | ---------------- | --------------------------------------------------------------- |
| **Auth**       | Clerk            | Session management, JWT issuance (web + mobile), user identity  |
| **Web API**    | tRPC             | Type-safe procedures for the Next.js React app                  |
| **REST API**   | Hono             | JSON REST endpoints for mobile clients & external consumers     |
| **ORM**        | Drizzle          | Type-safe SQL queries, schema definitions, migration generation |
| **Database**   | Supabase (PG)    | Persistent storage, Row Level Security via JWT claims           |
| **AI Gateway** | Express (LLM)    | Stateless prompt formatting, template registry, response cache  |
| **AI Cache**   | Redis            | Deduplicate identical prompts, optional TTL-based eviction      |
| **AI Model**   | Gemini 2.0 Flash | Text & JSON generation from structured prompts                  |
| **Migrations** | Drizzle Kit      | Schema diffing → SQL migration files → `supabase/migrations/`   |

---

## Port Map

| Service              | Port | Protocol |
| -------------------- | ---- | -------- |
| Next.js (web-client) | 3000 | HTTP     |
| LLM Service          | 3001 | HTTP     |
| Supabase Postgres    | 5432 | TCP (PG) |
| Redis                | 6379 | TCP      |

---

## Mobile Client Integration Pattern

```
                  ┌─────────────────────────┐
                  │      Mobile App          │
                  │                          │
                  │  1. Clerk SDK login      │
                  │     → session token      │
                  │                          │
                  │  2. REST calls to Hono   │
                  │     Authorization:       │
                  │     Bearer <token>       │
                  │                          │
                  │  3. Optional: direct     │
                  │     call to LLM :3001    │
                  │     for AI features      │
                  └────────┬────────────────┘
                           │
              ┌────────────┼────────────────┐
              │            │                │
              ▼            ▼                ▼
     ┌──────────┐  ┌────────────┐  ┌──────────────┐
     │ Hono API │  │ Hono API   │  │  LLM :3001   │
     │ /users/* │  │ /uploads/* │  │ /api/prompt/* │
     └────┬─────┘  └──────┬─────┘  └──────────────┘
          │               │
          ▼               ▼
     ┌──────────────────────┐
     │  Drizzle → Supabase  │
     │  (same RLS, same DB) │
     └──────────────────────┘
```

**Key insight**: Mobile uses the **exact same database layer** (Drizzle + Supabase RLS)
as the web client. Only the API transport differs — Hono REST instead of tRPC.

---

## Docker Topology (Production)

```
docker compose up

┌─────────────────────────────────────────────────┐
│                Docker Network                    │
│                                                  │
│  ┌──────────────────────┐  ┌─────────────────┐  │
│  │  llm-prompt-service  │  │   llm-redis     │  │
│  │  (node:22-alpine)    │  │   (redis:7)     │  │
│  │                      │  │                 │  │
│  │  :3001 ──────────────│──│─▶ :6379         │  │
│  │                      │  │                 │  │
│  │  ──── Gemini API ────│──│──▶ googleapis   │  │
│  └──────────────────────┘  └─────────────────┘  │
│            ▲                                     │
│            │ :3001 exposed                       │
└────────────┼─────────────────────────────────────┘
             │
        Host / Next.js / Mobile
```
