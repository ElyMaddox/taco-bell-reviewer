# 🌮 Taco Bell Reviewer

Rate Taco Bells around the country with your friends, item by item, visit by visit.

**Live app:** https://elymaddox.github.io/taco-bell-reviewer/

## How it works

- **Login:** email and password through Supabase Auth. Every review is tied to the person who wrote it.
- **Map:** Leaflet with OpenStreetMap tiles. Pins are colored by average score (red = 1, green = 5, gray = unrated).
- **Adding a location:** search an address or "Taco Bell + city" (free OpenStreetMap geocoder) and pick a result.
- **Reviews:** pick a menu item, give it 1 to 5 stars, set the visit date, add notes. You can review the same item at the same place as often as you like.

## Data model (Supabase Postgres)

| Table | What it holds |
| --- | --- |
| `profiles` | Display name per user, created automatically on sign-up |
| `locations` | Address and coordinates of each Taco Bell |
| `menu_items` | Shared list of items (seeded with common ones; anyone can add) |
| `reviews` | user, location, item, score 1–5, notes, visit date |
| `location_stats` (view) | Average score and review count per location |

Row level security: only signed-in users can read anything; you can only create, edit and delete your own reviews.

## Run locally

```bash
npm install
npm run dev
```

The Supabase URL and publishable key are built in (`src/supabase.ts`); override with `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` in `.env.local`.

## Deploy

Every push to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.
