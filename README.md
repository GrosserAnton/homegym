# Maxbody

Training &amp; nutrition tracker for your home gym. Build-free PWA — plain HTML/JS + [Supabase](https://supabase.com) over CDN, no build step. Just upload and go.

## Features

- **Auto-generate** a muscle-building plan from your available equipment and training days/week (adaptive split: Full Body → Upper/Lower → Push/Pull/Legs).
- **Plan builder** — create and edit your own splits, pick from ~870 exercises.
- **Exercise library** — search & filter by muscle group and equipment, with start/end movement images.
- **Workout tracking** — log weight & reps per set; last values are pre-filled next time.
- **History** of every logged session.
- **Nutrition diary** (free via Open Food Facts): meals (breakfast/lunch/dinner/snacks), calories + macros + micronutrients, daily targets with "remaining", week view, saved meals, recurring meals, copy-day, barcode scanning.
- **Calorie-needs calculator** (Mifflin-St Jeor) from body stats + goal.
- **Weight tracking** with a trend chart and history.
- Cross-device sync via Supabase. Login with **username** (registration with email once).

Exercise data & images: [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain), images served via jsDelivr.

## Tech

- No framework, no build — ES modules + `@supabase/supabase-js` from esm.sh.
- Data in Supabase tables `gym_profiles`, `gym_plans`, `gym_logs` (Row Level Security, user-scoped).
- PWA (installable, offline app shell via service worker).

## Setup

1. **Supabase**: the app points at a Supabase project in `js/config.js` (URL + publishable key — safe to expose; RLS protects the data). Tables `gym_*` must exist with RLS policies.
2. **Disable email confirmation** (so users can log in immediately): Supabase → Authentication → Sign In / Providers → Email → turn **off** "Confirm email". Otherwise configure custom SMTP.

## Deploy

It's a static site — upload the whole folder to any web host (e.g. Hostinger), ideally on its own (sub)domain. No server or build required.

## Local preview

Serve the folder over HTTP (ES modules don't work from `file://`). Any static server works.
