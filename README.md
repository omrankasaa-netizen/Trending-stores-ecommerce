# Trending Store — ترندينج ستور

Bilingual (English / العربية) gadget e-commerce store for Lebanon, live at
**[trending-store.com](https://trending-store.com)**. Cash-on-delivery ordering
over WhatsApp, with an admin panel for catalog, orders, and site content.

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS (RTL Arabic support)
- **Backend:** Node.js + Express + better-sqlite3 (file database)
- **Hosting:** Railway with a persistent volume for the SQLite database
- **Media:** Cloudflare R2 object storage (optional — falls back to local disk)
- **Email:** Resend (transactional email; optional)
- **Analytics:** Meta Pixel + Conversions API, TikTok Pixel + Events API (all optional)

## Setup

```bash
npm install
cp .env.example .env   # fill in the values you need (never commit .env)
```

Run the frontend and backend in separate terminals:

```bash
npm run dev      # Vite dev server (frontend)
npm run server   # Express API server (backend)
```

Production build and start:

```bash
npm run build
npm start
```

Tests:

```bash
npm test         # node --test tests/
```

## Admin account

The admin account is seeded automatically on first boot from environment
variables — there is **no default password in production**:

- `MINIYO_ADMIN_EMAIL` — admin login email (default `admin@trending.store`)
- `MINIYO_ADMIN_PASSWORD` — **required in production**; if unset, admin seeding
  is skipped with a loud warning

Set them as Railway variables (Service → Variables). See `SECURITY.md` for the
full secret-handling policy and `.env.example` for every supported variable.

## Security

Secrets are never committed. This repo runs gitleaks secret scanning on every
push and PR (see `.github/workflows/secret-scan.yml`) and ships an optional
pre-commit hook (`.pre-commit-config.yaml`). See `SECURITY.md`.
