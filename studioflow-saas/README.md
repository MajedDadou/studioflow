# StudioFlow SaaS MVP

StudioFlow is an internal order and retouch workflow tool for photography studios. It helps a studio turn customer photo selections into orders, selected image lines, retouch tasks, email previews, folder plans, reports, and audit logs.

StudioFlow is not a gallery, booking system, payment system, Lightroom plugin, or customer portal. It is the operational layer between the studio staff, the retoucher, and the local photo folders.

This README is for `studioflow-saas`, the Next.js SaaS-style MVP.

## Current Status

This app is ready for local visual testing and private-beta preparation. It includes seeded demo studios, development login, multi-studio scoping, customer/session/order workflows, retouch workflow, email template previews, safe Local Bridge simulation, subscription-plan structure, owner admin overview, reports, and smoke checks.

It is not ready for public launch yet. The main missing production pieces are real authentication, PostgreSQL migration/migrations, real email delivery, real billing, stronger test coverage, and a real signed local bridge agent.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite for local development
- PostgreSQL planned for hosted private beta and production

## Local Requirements

- Node.js 20 or newer
- npm
- Git

Check versions:

```bash
node -v
npm -v
git --version
```

## Environment Variables

Copy `.env.example` to `.env` for local development:

```bash
copy .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Local `.env` should usually contain:

```env
DATABASE_URL="file:./dev.db"
STUDIOFLOW_ADMIN_EMAILS="daniel@studioflow.test"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Production/private-beta variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Database connection. Use SQLite locally, PostgreSQL for hosted deployment. |
| `STUDIOFLOW_ADMIN_EMAILS` | Yes | Comma-separated owner/admin emails allowed to open `/admin`. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public URL of the app after deployment. |

Do not commit `.env`. It is ignored by Git.

## Local Setup

From the `studioflow-saas` folder:

```bash
npm install
npm run db:push
npm run seed
npm run smoke
npm run dev
```

Open:

```text
http://localhost:3000
```

The `db:push` script currently initializes the local SQLite database at:

```text
prisma/dev.db
```

Important: local `npm run db:push` resets the SQLite database. Use it for local test data, not for production data.

## Seed Guide

Seed demo data:

```bash
npm run seed
```

Seeded studios:

- Fotograf Guld
- Demo Portrait Studio

Seeded demo users:

- Daniel
- Sanne
- Martin
- Emma Demo
- Oliver Demo

Open `/login`, choose a user, choose a studio membership, and enter the app. Daniel is the default founder/admin user for `/admin`.

## Smoke Test

Run:

```bash
npm run smoke
```

The smoke test checks that the seeded database has studios, users, memberships, customers, sessions, orders, order items, retouch tasks, products, frames, email templates, bridge records, billing records, audit logs, and tenant-isolation samples.

Run build plus smoke:

```bash
npm run build
npm run smoke
```

or:

```bash
npm run check
```

## Running Locally

Start the development server:

```bash
npm run dev
```

Open on the laptop:

```text
http://localhost:3000
```

For a production-style local run:

```bash
npm run build
npm run start
```

## Testing From a Phone

### Same Wi-Fi

Use this when your phone and laptop are on the same network.

1. Start the app so it listens beyond localhost:

```bash
npm run dev -- --hostname 0.0.0.0
```

2. Find your laptop IP address.

Windows PowerShell:

```powershell
ipconfig
```

Look for the IPv4 address, for example:

```text
192.168.1.50
```

3. Open this on your phone:

```text
http://192.168.1.50:3000
```

4. If it does not open, check Windows Firewall and allow Node.js/private network access.

### Over the Internet

Use one of these options:

1. Deploy to Railway or Vercel with PostgreSQL. This is the best private-beta direction.
2. Use a temporary tunnel to your laptop for demo-only testing. This is useful for quick phone tests, but do not use it with real customer data.

Example with a temporary tunnel tool:

```bash
npm run dev -- --hostname 0.0.0.0
```

Then expose `http://localhost:3000` with your tunnel provider and open the generated HTTPS URL on your phone.

For real beta testing with studios, prefer a hosted deployment with PostgreSQL, HTTPS, real auth, and backups.

## Deployment Guide

### Recommended Private-Beta Path

For real testing over the internet:

1. Push this repo to GitHub.
2. Create a hosted PostgreSQL database.
3. Deploy the Next.js app to Railway or Vercel.
4. Set production environment variables in the hosting dashboard.
5. Push the Prisma schema to PostgreSQL.
6. Seed only safe demo/private-beta data.
7. Run smoke checks locally against the deployed database before inviting testers.

### Railway

Railway is a good fit for private beta because it can host the app and PostgreSQL in one project.

High-level steps:

1. Create a Railway project from the GitHub repo.
2. Add a PostgreSQL database service.
3. Copy the PostgreSQL `DATABASE_URL` into the app service variables.
4. Add:

```env
STUDIOFLOW_ADMIN_EMAILS="your-email@example.com"
NEXT_PUBLIC_APP_URL="https://your-app.up.railway.app"
```

5. Set build command:

```bash
npm run build
```

6. Set start command:

```bash
npm run start
```

### Vercel

Vercel is also suitable for the Next.js app, but do not use local SQLite for Vercel. Use a hosted PostgreSQL database such as Neon, Supabase, Railway PostgreSQL, or another managed Postgres provider.

High-level steps:

1. Import the GitHub repo into Vercel.
2. Set the project root to:

```text
studioflow-saas
```

3. Add environment variables:

```env
DATABASE_URL="postgresql://..."
STUDIOFLOW_ADMIN_EMAILS="your-email@example.com"
NEXT_PUBLIC_APP_URL="https://your-vercel-domain.vercel.app"
```

4. Use the default Next.js build command:

```bash
npm run build
```

5. Use a PostgreSQL migration/push step before private-beta data is used.

## PostgreSQL Guide

The app currently uses SQLite locally:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

For hosted private beta, move to PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then run against the hosted database:

```bash
npx prisma generate
npx prisma db push
npm run seed
npm run smoke
```

Production recommendation:

- Use Prisma migrations instead of ad hoc `db push` once the schema stabilizes.
- Do not run the local SQLite `npm run db:push` against production.
- Back up the database before schema changes.
- Keep `DATABASE_URL` only in the hosting provider environment variables.

## GitHub Hygiene

Ignored local files include:

- `.env`
- `.env.local`
- `.next/`
- `node_modules/`
- `prisma/dev.db`
- `*.db`
- `*.sqlite`
- `safe-test-folder/StudioFlow_Test/`
- generated `.txt` bridge files
- logs

Before pushing:

```bash
git status --short
git check-ignore .env prisma/dev.db safe-test-folder/StudioFlow_Test/order-summary.txt
```

Do not commit:

- real customer data
- local databases
- environment files
- bridge-generated folders/files
- API keys
- payment provider secrets
- SMTP passwords

## Private Beta Checklist

Before inviting a real studio:

- Build passes with `npm run build`.
- Smoke test passes with `npm run smoke`.
- `.env` is not committed.
- Local database files are not committed.
- Founder/admin email list is set.
- Test users and studios are reviewed.
- No real payment processing is enabled.
- No real email sending is enabled.
- Local Bridge remains dry-run or safe-test-folder only.
- Studio owners understand this is private beta software.
- Privacy policy and data handling notes are drafted.
- Database backup plan exists.
- Bug reporting process exists.
- Clear test script is prepared for staff.

## Known Limitations

- Development login is not production authentication.
- Cookies are a local auth simulation, not a real auth session system.
- SQLite is for local testing only.
- PostgreSQL migration is planned but not fully automated.
- No Stripe or Paddle integration yet.
- No real email sending yet.
- Local Bridge is a safe simulator, not a signed bridge agent.
- No customer portal.
- No image previews or Lightroom/Capture One integration.
- Validation and automated tests are not complete enough for public launch.
- GDPR/privacy workflows need legal review before real customer data is used.

## What Is Still Needed Before Public Launch

- Real auth provider such as Clerk, Auth.js, or Supabase Auth.
- Production PostgreSQL migrations.
- Strong role/permission enforcement across every action.
- Real email provider integration and unsubscribe/privacy handling where relevant.
- Real billing provider integration with Stripe or Paddle.
- Production-grade audit logs and admin tools.
- Proper error pages and support flow.
- Database backup and restore process.
- Privacy policy, data processing agreement, terms, and cookie policy.
- Security review.
- End-to-end tests for customer, session, order, retouch, email, billing, and bridge flows.
- A separate local bridge desktop/service app for real studio folder automation.
