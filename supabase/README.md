# Supabase Local Development

This directory contains Supabase configuration and edge functions for local development.

## Getting Started

1. Install Supabase CLI:

   ```bash
   brew install supabase/tap/supabase
   ```

2. Start the local Supabase stack:

   ```bash
   supabase start
   ```

3. Access local services:
   - **Studio**: http://localhost:54323
   - **API**: http://localhost:54321
   - **Database**: postgresql://postgres:postgres@localhost:54322/postgres

## Edge Functions

Edge functions are located in `supabase/functions/`. To create a new function:

```bash
supabase functions new my-function
```

To serve functions locally:

```bash
supabase functions serve
```

## Migrations

Database migrations are located in `supabase/migrations/`. To create a new migration:

```bash
supabase migration new my_migration
```

## Environment Variables

For local development, Supabase uses the values in `config.toml`. For production, set environment variables in your Supabase dashboard.

## Clerk Integration

This project uses Clerk for authentication with Supabase Row Level Security (RLS). The integration works by:

1. Clerk generates a JWT with the Supabase template
2. The web app passes this JWT to Supabase via the `getSecureDb()` function
3. Supabase RLS policies check the JWT claims
