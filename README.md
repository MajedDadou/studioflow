# StudioFlow

StudioFlow is a local MVP workspace for photography studio workflow software.

This repository currently contains two app versions:

- `studioflow/` - original Flask + SQLite local MVP.
- `studioflow-saas/` - newer Next.js + TypeScript + Tailwind + Prisma + SQLite SaaS-style MVP.

The current product prototype to test visually is `studioflow-saas/`.

## Run The Next.js MVP

```bash
cd studioflow-saas
npm install
npm run db:push
npm run seed
npm run dev
```

Open:

```text
http://localhost:3000
```

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
