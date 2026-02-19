# Monorepo Starter

A full-stack monorepo starter template with modern technologies and best practices.

## Tech Stack

### Web Client (`apps/web-client`)

- **Next.js 16** - React framework with App Router
- **tRPC 11** - End-to-end type-safe API
- **Drizzle ORM** - Type-safe SQL ORM
- **Clerk Auth** - Authentication with Supabase RLS integration
- **Tailwind CSS 4** - Utility-first CSS
- **shadcn/ui** - Radix-based component library
- **Zustand** - State management

### LLM Service (`apps/llm`)

- **Express.js** - Minimal web framework
- **MongoDB** - NoSQL database
- **Google Gemini** - AI/LLM integration
- **TypeScript** - Full type safety

### Database (`supabase/`)

- **Supabase** - PostgreSQL with Row Level Security
- **Clerk JWT** - Authentication tokens for RLS policies

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- Docker (for local Supabase)
- MongoDB (for LLM service)

### Installation

1. Clone the repository:

   ```bash
   git clone <repo-url> my-project
   cd my-project
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:

   ```bash
   # Root
   cp .env.example .env

   # Web client
   cp apps/web-client/.env.example apps/web-client/.env

   # LLM service
   cp apps/llm/.env.example apps/llm/.env
   ```

4. Start Supabase:

   ```bash
   pnpm supa:start
   ```

5. Run database migrations:

   ```bash
   pnpm db:push
   ```

6. Start development servers:

   ```bash
   # Web client
   pnpm dev:web

   # LLM service (in another terminal)
   pnpm dev:llm
   ```

## Project Structure

```
monorepo-starter/
├── apps/
│   ├── web-client/          # Next.js web application
│   │   ├── src/
│   │   │   ├── app/         # Next.js App Router pages
│   │   │   ├── components/  # React components
│   │   │   ├── db/          # Drizzle database setup
│   │   │   ├── lib/         # Utility functions
│   │   │   ├── server/      # tRPC server setup
│   │   │   ├── services/    # Feature services (theme, users, etc.)
│   │   │   ├── styles/      # Global styles
│   │   │   ├── trpc/        # tRPC client setup
│   │   │   └── types/       # TypeScript types
│   │   └── package.json
│   │
│   └── llm/                 # Express LLM service
│       ├── src/
│       │   ├── lib/         # MongoDB & Gemini clients
│       │   └── routes/      # API routes
│       └── package.json
│
├── supabase/
│   ├── config.toml          # Supabase local config
│   └── migrations/          # Database migrations
│
├── package.json             # Root workspace config
└── README.md
```

## Features

### Theme Service

The theme service provides a complete theming solution:

```typescript
import { ThemeProvider, useTheme } from "@/services/theme";

// In your layout
<ThemeProvider>
  <YourApp />
</ThemeProvider>

// In your components
const { theme, toggleTheme } = useTheme();
```

Features:

- Light/dark mode with system preference detection
- Multiple theme presets
- HSL color adjustments
- Persistent theme state
- URL-based theme switching (`?theme=preset-name`)

### tRPC API

Type-safe API calls with automatic inference:

```typescript
// Server procedure
export const appRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return { greeting: `Hello ${input.text}!` };
    }),
});

// Client usage
const { data } = useQuery(trpc.hello.queryOptions({ text: "World" }));
```

### Database with RLS

Secure database access with Clerk JWT:

```typescript
// In your procedures
const { data } = await ctx.secureDb.rls(async (tx) => {
  return tx.select().from(users).where(eq(users.id, ctx.user.id));
});
```

## Scripts

| Command           | Description                     |
| ----------------- | ------------------------------- |
| `pnpm dev:web`    | Start web client dev server     |
| `pnpm dev:llm`    | Start LLM service dev server    |
| `pnpm build:web`  | Build web client for production |
| `pnpm db:push`    | Push schema changes to database |
| `pnpm db:studio`  | Open Drizzle Studio             |
| `pnpm supa:start` | Start local Supabase            |
| `pnpm supa:stop`  | Stop local Supabase             |

## Environment Variables

### Web Client

```env
# Database
DATABASE_URL=postgresql://...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### LLM Service

```env
# Server
PORT=3001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/starter

# Gemini AI
GEMINI_API_KEY=your_key_here
```

## License

MIT
