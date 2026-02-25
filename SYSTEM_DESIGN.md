# Developer Guide — CaFair Platform

> How to add services, APIs, database tables, and pages to this monorepo.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Adding a New Service](#2-adding-a-new-service)
3. [Database Schema](#3-database-schema)
4. [tRPC API (Web)](#4-trpc-api-web)
5. [Hono API (REST)](#5-hono-api-rest)
6. [LLM Integration](#6-llm-integration)
7. [Auth & RLS](#7-auth--rls)
8. [Theme System](#8-theme-system)

---

## 1. Project Structure

```
cafair/
├── apps/
│   ├── web-client/          # Next.js 16 — frontend + API layer
│   │   ├── src/
│   │   │   ├── app/         # Next.js App Router pages
│   │   │   ├── components/  # Reusable UI (loading, error, navbar, ui/)
│   │   │   ├── db/          # Drizzle DB client + schema barrel
│   │   │   ├── server/      # tRPC init + routers, Hono app
│   │   │   ├── services/    # Feature modules (users, examples, uploads, theme)
│   │   │   ├── trpc/        # tRPC client + server helpers
│   │   │   └── styles/      # globals.css (Tailwind v4 + theme vars)
│   │   └── supabase/        # (empty — migrations at root)
│   └── llm/                 # Express — LLM prompt microservice
│       ├── src/
│       │   ├── lib/          # gemini, redis, prompt-formatter, prompt-templates
│       │   └── routes/       # health, prompt
│       └── docker-compose.yml
├── supabase/
│   ├── config.toml
│   └── migrations/          # SQL migration files (Drizzle Kit)
├── ARCHITECTURE.md
├── SYSTEM_DESIGN.md          # (this file)
└── package.json              # npm workspaces root
```

---

## 2. Adding a New Service

Services live in `apps/web-client/src/services/<name>/`. Each follows this pattern:

```
services/your-feature/
├── schema/
│   └── index.ts          # Drizzle table definitions
├── procedures/
│   └── index.ts          # tRPC router (queries + mutations)
└── index.ts              # Barrel export
```

### Step by Step

1. **Create the directory** — `mkdir -p src/services/your-feature/{schema,procedures}`

2. **Define your schema** — `schema/index.ts`:

   ```ts
   import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

   export const yourTable = pgTable("your_table", {
     id: uuid("id").primaryKey().defaultRandom(),
     userId: text("user_id").notNull(),
     title: text("title").notNull(),
     createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
   });
   ```

3. **Register the schema** — add to `src/db/schema/index.ts`:

   ```ts
   export * from "@/services/your-feature/schema";
   ```

4. **Create procedures** — `procedures/index.ts`:

   ```ts
   import { router, authedProcedure } from "@/server/init";
   import { yourTable } from "../schema";
   import { z } from "zod";

   export const yourFeatureRouter = router({
     list: authedProcedure.query(async ({ ctx }) => {
       return ctx.secureDb.rls((tx) => tx.select().from(yourTable));
     }),
     create: authedProcedure
       .input(z.object({ title: z.string() }))
       .mutation(async ({ ctx, input }) => {
         return ctx.secureDb.rls((tx) =>
           tx
             .insert(yourTable)
             .values({
               userId: ctx.userId,
               title: input.title,
             })
             .returning(),
         );
       }),
   });
   ```

5. **Register the router** — add to `src/server/routers/app.ts`:

   ```ts
   import { yourFeatureRouter } from "@/services/your-feature/procedures";
   // ...
   export const appRouter = router({
     // ...existing
     yourFeature: yourFeatureRouter,
   });
   ```

6. **Generate migration** — `npm run db:generate` then `npm run db:migrate`

7. **Add a page** — `src/app/(dashboard)/your-feature/page.tsx`

---

## 3. Database Schema

Current tables:

| Table               | Description                                  |
| ------------------- | -------------------------------------------- |
| `users`             | Clerk-synced user records                    |
| `examples`          | Example items (for reference)                |
| `events`            | Career fair events                           |
| `job_roles`         | Job openings linked to events                |
| `candidates`        | Pipeline candidates with scores, stage, lane |
| `evidence`          | Resume/code links attached to candidates     |
| `recruiter_actions` | Follow-up actions (email, schedule, reject)  |

All tables use `text("user_id")` referencing Clerk user IDs.
RLS is enforced via `secure-client.ts` which sets `request.jwt.claims` before each query.

### Running migrations

```bash
npm run db:generate    # Diff schema → SQL
npm run db:migrate     # Apply to Supabase
npm run db:studio      # Visual DB browser
```

---

## 4. tRPC API (Web)

### Architecture

```
useTRPC() → httpBatchLink → /api/trpc/* → tRPC Router → Drizzle → Supabase
```

### Usage in components

```tsx
"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";

function MyComponent() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.yourFeature.list.queryOptions());
  const mutation = useMutation(trpc.yourFeature.create.mutationOptions());

  return <button onClick={() => mutation.mutate({ title: "New" })}>Add</button>;
}
```

### SSR prefetching

```tsx
// In a Server Component
import { trpc } from "@/trpc/server";
import { HydrateClient } from "@/trpc/server";

export default async function Page() {
  void trpc.yourFeature.list.prefetch();
  return (
    <HydrateClient>
      <MyComponent />
    </HydrateClient>
  );
}
```

---

## 5. Hono API (REST)

REST endpoints for mobile / external clients at `/api/v1/*`.

`/api/mobile/*` remains available as a compatibility alias.

### Adding a route

```ts
// src/server/hono/routes/your-feature.ts
import { Hono } from "hono";
import type { AuthEnv } from "../middleware";
import { yourTable } from "@/services/your-feature/schema";
import { db } from "@/db";
import { eq } from "drizzle-orm";

const app = new Hono<AuthEnv>();

app.get("/", async (c) => {
  const userId = c.var.userId;
  const items = await db
    .select()
    .from(yourTable)
    .where(eq(yourTable.userId, userId));

  return c.json({ data: items });
});

export default app;
```

Mount in `src/server/hono/app.ts`:

```ts
import yourFeatureRoutes from "./routes/your-feature";
app.route("/your-feature", yourFeatureRoutes);
```

---

## 6. LLM Integration

The LLM service at `:3001` provides two AI models:

- **Amazon Nova Lite** (via AWS Bedrock) — candidate scoring at `POST /api/score`
- **Google Gemini Flash** (fallback) — prompt templates at `/api/prompt/*`

### Candidate Scoring (Nova)

- `POST /api/score` — score a resume against a job description

The web-client calls this via the `scoreCandidate` tRPC mutation, which orchestrates
the LLM request and persists results. See `src/docs/BACKEND_API_GUIDE.md` for usage.

### Prompt Templates (Gemini)

- `POST /api/prompt/run` — run a registered template
- `POST /api/prompt/raw` — run a custom prompt
- `GET /api/prompt/templates` — list available templates

### Adding a template

Edit `apps/llm/src/lib/prompt-templates.ts`:

```ts
export const myTemplate: PromptTemplate = {
  name: "my-template",
  description: "Does something useful",
  variables: ["input"],
  template: {
    role: "You are an expert at X",
    task: "Do Y with the following input",
    rules: ["Be concise", "Return JSON"],
    input: "{{input}}",
    output: "Return a JSON object with ...",
  },
};
```

Register it in the `templateRegistry` Map at the bottom of the file.

---

## 7. Auth & RLS

### Flow

1. **Clerk** handles login (web: cookie, mobile: Bearer JWT)
2. **`proxy.ts`** middleware validates the session
3. **`secure-client.ts`** injects JWT claims into Postgres via `set_config('request.jwt.claims', ...)`
4. **RLS policies** use `auth.user_id()` SQL function to restrict rows

### Adding RLS to a new table

```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their rows"
  ON your_table FOR ALL
  USING (user_id = auth.user_id());
```

---

## 8. Theme System

See `services/theme/README.md` for full documentation.

Key concepts:

- 20+ built-in presets stored in `presets/built-in.ts`
- Zustand store for reactive state
- CSS custom properties applied via `apply/apply-theme.ts`
- View Transitions API for smooth swaps
- Color conversion via `culori` in `utils/color-converter.ts`
