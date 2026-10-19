# Northymbra Warband Chronicler — Burrows & Badgers (2nd Edition)

A full-featured, mobile-friendly Warband, Den, Campaign, and Active-Game Manager for **Burrows & Badgers (2nd Edition)**.

## Features
- **2.0 Warband Creation Wizard:** Choose your Warband Allegiance to automatically establish your starting Den Type, starting Den Upgrade, and 350 Pennies treasury.
- **Roster & Equipment Outfitting:** Recruit Leaders, Seconds, Henchbeasts, and Hired Paws; equip weapons, shields, armour, and accessories; automatically compute effective dice stats (`Move`, `Strike`, `Block`, `Ranged`, `Nimbleness`, `Fortitude`, `Courage`, `Wounds`) and **Warband Rating**.
- **Den Upgrades (12 Roster Slots) & Den Stash:** Construct Den Upgrades, toggle newly built vs. active Step 9 upgrades, buy/stash/sell equipment, and track every Penny in the Treasury Ledger.
- **Experience, Leveling & Post-Battle Injuries:** Track XP thresholds, apply characteristic die-step advances, learn new Skills or Magic Spells, and record Post-Battle Injuries (including automatic *Miss Next Game* status).
- **Mobile "Active Game" Tracker:** Designed for phone use at the gaming table—track current Wounds, Fate Points, round activations, status conditions (*Prone*, *Stunned*, *Bleeding*, *Poisoned*, *Hidden*, *Out of Action*), and roll polyhedral dice (`D4`–`D100`).
- **Printable / PDF Roster & Fighter Cards:** Dedicated `@media print` view for full Warband Record Sheets or compact Tabletop Fighter Reference Cards with wound checkboxes.
- **2.0 Rules Data Compendium & Editor:** Add, edit, import, or export your exact 2nd Edition rulebook tables (Species, Allegiances, Equipment, Skills/Spells, Den Upgrades, and Injuries).
- **Hybrid Storage (Instant Local Mode + Supabase Cloud & Google OAuth):** Works immediately offline in your browser with JSON backups, or connect a free Supabase project for 1-click Google Sign-In and shared Campaign synchronization.

## Quick Start (Local Development)

```bash
npm install
npm run dev
```

## Connecting Google Sign-In & Supabase Cloud ($0/month Free Tier)
1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in Supabase and run [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql).
3. In Supabase **Authentication -> Providers**, enable **Google**.
4. Either paste your **Project URL** and **Anon Key** directly inside the app via **Google Sign-In / Backups** in the top navigation bar, or copy `.env.example` to `.env`.
5. *(Optional)* Push to GitHub and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your repository secrets so [`.github/workflows/supabase-keepalive.yml`](./.github/workflows/supabase-keepalive.yml) automatically pings your free database twice a week.
