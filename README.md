# StudioFlow

StudioFlow is a local MVP workspace for photography studio workflow software.

This repository currently contains two app versions:

- `studioflow/` - original Flask + SQLite local MVP.
- `studioflow-saas/` - newer Next.js + TypeScript + Tailwind + Prisma + SQLite SaaS-style MVP.

The current product prototype to test visually and prepare for private beta is `studioflow-saas/`.

For phone testing, deployment, PostgreSQL, seed data, smoke tests, and private-beta checklist, read:

```text
studioflow-saas/README.md
```

## Run The Next.js MVP

```bash
cd studioflow-saas
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

To test from a phone on the same Wi-Fi, run the Next.js app with:

```bash
npm run dev -- --hostname 0.0.0.0
```

Then open `http://YOUR-LAPTOP-IP:3000` on the phone.

## Run The Flask MVP

```bash
cd studioflow
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open:

```text
http://localhost:5000
```

## What Is Ignored

This repository intentionally does not upload:

- `node_modules`
- `.next`
- Python virtual environments
- local SQLite database files
- generated test folders/files
- environment files such as `.env`

Recreate local databases with the setup and seed commands in each app folder.
