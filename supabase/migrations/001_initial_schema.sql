-- ============================================================================
-- Burrows & Badgers (2nd Edition) Warband Manager
-- Supabase PostgreSQL Schema & Row-Level Security (RLS) Migration
-- ============================================================================

create extension if not exists "uuid-ossp";

-- 1. Custom Rules & Reference Data Snapshot (per user or global override)
create table if not exists public.rules_datasets (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null default 'Burrows & Badgers 2.0 Core',
  is_public boolean not null default false,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. Campaigns / Leagues
create table if not exists public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text not null default '',
  invite_code text unique not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. Warbands (Full warband document + relational metadata for fast querying)
create table if not exists public.warbands (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null default 'Commander',
  campaign_id uuid references public.campaigns(id) on delete set null,
  name text not null,
  allegiance_id text not null,
  den_name text not null default '',
  treasury_pennies integer not null default 350,
  fate_points integer not null default 0,
  warband_rating integer not null default 0,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 4. Campaign Matches / Battle Reports
create table if not exists public.campaign_matches (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scenario text not null,
  warband_a_id uuid references public.warbands(id) on delete set null,
  warband_a_name text not null,
  warband_b_id uuid references public.warbands(id) on delete set null,
  warband_b_name text not null,
  winner_warband_id uuid references public.warbands(id) on delete set null,
  summary_notes text not null default '',
  played_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================

alter table public.rules_datasets enable row level security;
alter table public.campaigns enable row level security;
alter table public.warbands enable row level security;
alter table public.campaign_matches enable row level security;

-- Rules Datasets: Users can read public datasets or their own, and edit their own
create policy "Read public or own rules datasets"
  on public.rules_datasets for select
  using (is_public = true or auth.uid() = owner_id);

create policy "Insert own rules datasets"
  on public.rules_datasets for insert
  with check (auth.uid() = owner_id);

create policy "Update own rules datasets"
  on public.rules_datasets for update
  using (auth.uid() = owner_id);

-- Campaigns: Any authenticated user can view/join campaigns and create campaigns
create policy "Authenticated users can read campaigns"
  on public.campaigns for select
  to authenticated
  using (true);

create policy "Authenticated users can create campaigns"
  on public.campaigns for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Creators can update campaigns"
  on public.campaigns for update
  to authenticated
  using (auth.uid() = created_by);

-- Warbands: Users can read their own warbands OR any warband in a shared campaign; only owners can mutate
create policy "Users can view own warbands or campaign warbands"
  on public.warbands for select
  to authenticated
  using (auth.uid() = user_id or campaign_id is not null);

create policy "Users can create their own warbands"
  on public.warbands for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own warbands"
  on public.warbands for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own warbands"
  on public.warbands for delete
  to authenticated
  using (auth.uid() = user_id);

-- Campaign Matches: Authenticated users can view and log matches
create policy "Authenticated users can read campaign matches"
  on public.campaign_matches for select
  to authenticated
  using (true);

create policy "Authenticated users can insert campaign matches"
  on public.campaign_matches for insert
  to authenticated
  with check (auth.uid() = created_by);
