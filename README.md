This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Database Schema & Migrations

This project uses Supabase (Postgres + Auth + Realtime + Storage). All database changes are tracked via Supabase migrations.

### Making Database Changes

Do **NOT** run manual, untracked `ALTER TABLE` statements in the SQL editor without versioning them. Always create a tracked migration:

```bash
# 1. Create a new migration file
supabase migration new <migration_name>

# 2. Edit the generated file in supabase/migrations/

# 3. Apply the migration to the remote database
supabase db push
```

> **Note**: `supabase db push` applies pending migrations and reloads PostgREST's schema cache automatically. If you ever run SQL directly in the Supabase Dashboard, you MUST run:
> ```sql
> NOTIFY pgrst, 'reload schema';
> ```
> to refresh PostgREST's schema cache and prevent `"Could not find column in schema cache"` errors.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

