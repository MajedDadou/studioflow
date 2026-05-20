# StudioFlow SaaS MVP

StudioFlow is a local, testable MVP for an internal photography studio workflow product. It helps small and medium photo studios turn customer selections into organized orders, retouch tasks, folder plans, and communication templates without paper notes or manual handoff chaos.

This version is a SaaS-style prototype that runs locally. It is configurable per studio and includes a fake studio switcher instead of real authentication.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- SQLite
- Prisma ORM
- Local development only

## What the MVP includes

- Landing page and positioning
- Fake login / studio switcher
- Seeded demo studios:
  - Fotograf Guld
  - Demo Portrait Studio
- Dashboard with deadlines, active orders, retouch warnings, and activity
- Customers with search, create, edit, and detail views
- Photo sessions connected to customers and folder paths
- Orders created from sessions
- Single or bulk selected image/order item entry with full filenames or image numbers
- Configurable products and frames
- Retouch tasks with retoucher assignment and status changes
- Retoucher management
- Studio settings for statuses, order ID format, folder naming, photographers, retouch types, and capture workflow
- Local Bridge simulator with dry-run and safe test-folder creation only
- Email template preview and copy generation without real sending
- Pricing/subscription plan structure in the database and UI
- Simple reports page

## Safety model

The Local Bridge page is a simulator.

- It does not delete files.
- It does not move images.
- It does not overwrite `order-summary.txt`.
- Dry-run is enabled by default.
- Test folder creation is restricted to:

```text
safe-test-folder/StudioFlow_Test
```

The intended future architecture is:

- Cloud app stores studios, customers, sessions, orders, tasks, templates, and settings.
- Local bridge app runs at the studio and handles approved local folder/file operations.
- StudioFlow should only touch approved folders.
- Bridge actions should copy files, not delete originals.
- Every action should be previewed and logged.

## Setup

Install dependencies:

```bash
npm install
```

Create the SQLite database and Prisma client:

```bash
npm run db:push
```

In this repository, `db:push` runs `prisma/init.ts`, which creates the SQLite tables from the Prisma-generated schema SQL. This keeps local setup reliable even if Prisma's schema engine is unavailable on a Windows development machine.

Seed demo data:

```bash
npm run seed
```

Verify that the MVP is ready to open:

```bash
npm run smoke
```

Run a production build plus the smoke check:

```bash
npm run check
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

You can run the full local setup with:

```bash
npm run setup
```

## Database

The SQLite database is created at:

```text
prisma/dev.db
```

The Prisma schema is:

```text
prisma/schema.prisma
```

## Fake login / studio switcher

There is no real authentication yet. Use:

```text
/login
```

or the sidebar studio switcher to change the active demo studio. The app stores the active studio ID in a local cookie.

## Useful test flow

1. Open `/dashboard`.
2. Switch between Fotograf Guld and Demo Portrait Studio.
3. Create a customer.
4. Create a session connected to that customer.
5. Create an order from the session.
6. Add one selected image, or use bulk paste for selections like `IMG_1023.CR3`, `IMG_1024.CR3`, `1025`, or `1026`.
7. Assign retouch instructions and a retoucher.
8. Open Retouch Tasks and update task status.
9. Open Email Templates and preview a retouch email.
10. Open Local Bridge, generate a folder plan, then create safe test folders.

## Daily studio workflow test

Use this flow when showing the MVP to a studio owner:

1. Start on `/dashboard` and check the MVP readiness panel.
2. Create a customer and session.
3. Create an order from the session.
4. Use Bulk paste images to add several selected image references with the same product settings.
5. Open the order and confirm the operational checklist is green.
6. Preview the retouch email.
7. Preview the Local Bridge folder plan in dry-run mode.
8. Create test folders only inside `safe-test-folder/StudioFlow_Test`.

## Subscription plans

The database and UI include:

- Free Trial
- Starter
- Studio
- Pro

There is no Stripe or payment integration yet.

## Known limitations

- No real authentication or user permissions.
- No real email sending.
- No real cloud/local bridge pairing.
- No real payment processing.
- No production file automation.
- No image previews or direct Lightroom/Capture One integration.
- Form validation is intentionally lightweight for MVP speed.

## Next steps toward a real SaaS

- Add real authentication and studio membership roles.
- Add hosted database and multi-tenant authorization checks.
- Add Stripe subscriptions and plan enforcement.
- Build a separate signed local bridge app/agent.
- Add real email sending with audit logs.
- Add import/export tools for existing studio data.
- Add stronger validation and optimistic UI states.
- Add automated tests for server actions and folder safety rules.
