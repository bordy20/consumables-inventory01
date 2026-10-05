# Consumables — AI Inventory

Household consumables tracker: scan a product with your phone camera, get low-stock and expiry alerts, keep a shopping list, and chat with an assistant about what you have. Installs to your phone's home screen and works offline.

Stack: Vite + React (PWA) · Vercel serverless functions · Vercel KV / Upstash Redis · Claude (Haiku) for scan + chat.

## Deploy (Vercel)

1. Import the repo into Vercel (framework preset: Vite — `vercel.json` already sets it).
2. **Storage:** Project → Storage → connect an Upstash Redis (Vercel KV) database. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. **Environment variables** (see `.env.example`):
   - `ANTHROPIC_API_KEY` — required for scan + chat.
   - `APP_ACCESS_CODE` — **set this.** The app asks for it once per device. Without it, anyone who finds the URL can spend your Anthropic credits.
   - `ANTHROPIC_MODEL` — optional override (default `claude-haiku-4-5-20251001`).
4. Redeploy.

> **Preview deployments** (pull request branches) only get the environment variables and storage you enable for the **Preview** environment. If a preview shows an empty inventory and an orange/red ⚙️ dot, connect the storage to Preview too and redeploy.

## Install on your phone

- **iPhone:** open the site in **Safari** → Share → **Add to Home Screen**.
- **Android:** open in Chrome → menu → **Install app**.

### ⚠️ Moving your existing data into the installed app (iPhone)

The home-screen app has **separate storage** from Safari, so it starts empty. Your inventory is stored in the cloud under a *sync key*:

1. In the version you already use (Safari), tap ⚙️ (top right) → **Copy key**.
2. Open the home-screen app → ⚙️ → paste into **Use a different sync key** → **Switch to this key**.

Your items appear. Do the same on any other phone to share one inventory. Treat the key like a password.

## What changed in the production pass

- **Security:** same-origin only (no wildcard CORS), optional access code, per-IP and per-user rate limits on all routes, server-side validation/size caps, safe error messages, AI output normalised, HTML-escaped chat rendering.
- **Fixed:** chat sent the assistant greeting as the first message (rejected by the API) and then crashed on the empty reply — now fixed with an offline fallback.
- **Sync:** versioned saves with automatic merge (newest edit per item wins, deletions propagate), offline queue with retry, refresh when the app returns to the foreground, sync status dot in ⚙️.
- **Chat can change stock:** say "remove 2 water", "I bought 3 rice" or "add milk to my shopping list". Only quantity changes, adding items and the shopping list are allowed (no deletes), and the chat shows before → after. If the AI can't be reached it says nothing was changed.
- **Sync status:** ⚙️ shows why syncing failed (e.g. "Server error (500) — check the storage connection").
- **Phone UX:** installable PWA with offline app shell, bottom tab bar, safe-area support (notch / home bar), 16px inputs (no iOS zoom), larger touch targets, camera **and** photo-library pickers, native share sheet for backup/shopping list, error screen instead of a blank page.

## Develop

```bash
npm install
npm run dev     # front end only; /api needs `vercel dev` and the env vars above
npm test        # unit + sync tests (no network needed)
npm run build
```

## Known limits

- Saves use optimistic concurrency, not atomic compare-and-set: if two devices save within the same few milliseconds, one will be asked to merge on its next sync. Fine for a household; not built for large teams.
- Ids created before this update are shorter (~14 chars) than new ones (28). They still work; if you want a stronger key, create a fresh install and import a backup file.
- Scanning needs a connection; offline it falls back to filename matching and manual entry.
