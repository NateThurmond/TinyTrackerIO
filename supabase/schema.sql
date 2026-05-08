-- TinyTrackerIO Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  display_name text,
  unit_preference text not null default 'ml' check (unit_preference in ('ml', 'oz')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- BABIES
-- ─────────────────────────────────────────────
create table if not exists public.babies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  gender text check (gender in ('male', 'female', 'other')),
  birth_date date,
  photo_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.babies enable row level security;

-- ─────────────────────────────────────────────
-- BABY CAREGIVERS (junction table)
-- ─────────────────────────────────────────────
create table if not exists public.baby_caregivers (
  id uuid primary key default uuid_generate_v4(),
  baby_id uuid references public.babies(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'caregiver' check (role in ('owner', 'caregiver')),
  created_at timestamptz not null default now(),
  unique(baby_id, user_id)
);

alter table public.baby_caregivers enable row level security;

-- Babies: users can see babies they are caregivers for
create policy "Caregivers can view baby"
  on public.babies for select
  using (
    exists (
      select 1 from public.baby_caregivers
      where baby_id = babies.id and user_id = auth.uid()
    )
  );

-- Creator can see baby immediately after insert (before caregiver record exists)
create policy "Creator can view baby"
  on public.babies for select
  using (created_by = auth.uid());

create policy "Caregivers can update baby"
  on public.babies for update
  using (
    exists (
      select 1 from public.baby_caregivers
      where baby_id = babies.id and user_id = auth.uid()
    )
  );

create policy "Users can create babies"
  on public.babies for insert
  with check (created_by = auth.uid());

-- Security definer function to check ownership without triggering RLS recursion
create or replace function public.is_baby_owner(p_baby_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.baby_caregivers
    where baby_id = p_baby_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- Caregivers can see their own caregiver records
create policy "Users can view own caregiver records"
  on public.baby_caregivers for select
  using (user_id = auth.uid());

create policy "Owners can manage caregivers"
  on public.baby_caregivers for all
  using (public.is_baby_owner(baby_id));

create policy "Users can insert own caregiver record"
  on public.baby_caregivers for insert
  with check (user_id = auth.uid());

-- All caregivers of the same baby can see each other (needed for The Village section)
create policy "Caregivers can view sibling caregivers"
  on public.baby_caregivers for select
  using (
    exists (
      select 1 from public.baby_caregivers bc2
      where bc2.baby_id = baby_caregivers.baby_id
        and bc2.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- INVITES
-- ─────────────────────────────────────────────
create table if not exists public.invites (
  id uuid primary key default uuid_generate_v4(),
  baby_id uuid references public.babies(id) on delete cascade not null,
  email text not null,
  token uuid not null default uuid_generate_v4(),
  accepted boolean not null default false,
  created_by uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

alter table public.invites enable row level security;

create policy "Owners can manage invites"
  on public.invites for all
  using (created_by = auth.uid());

create policy "Anyone can read invite by token"
  on public.invites for select
  using (true);

-- ─────────────────────────────────────────────
-- FEEDINGS
-- ─────────────────────────────────────────────
create table if not exists public.feedings (
  id uuid primary key default uuid_generate_v4(),
  baby_id uuid references public.babies(id) on delete cascade not null,
  logged_by uuid references auth.users(id) on delete set null not null,
  amount_ml integer not null check (amount_ml > 0),
  notes text,
  fed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feedings enable row level security;

create policy "Caregivers can manage feedings"
  on public.feedings for all
  using (
    exists (
      select 1 from public.baby_caregivers
      where baby_id = feedings.baby_id and user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- DIAPERS
-- ─────────────────────────────────────────────
create table if not exists public.diapers (
  id uuid primary key default uuid_generate_v4(),
  baby_id uuid references public.babies(id) on delete cascade not null,
  logged_by uuid references auth.users(id) on delete set null not null,
  type text not null check (type in ('pee', 'poop', 'mixed')),
  size text check (size in ('small', 'med', 'big', 'ginormous')),
  notes text,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diapers enable row level security;

create policy "Caregivers can manage diapers"
  on public.diapers for all
  using (
    exists (
      select 1 from public.baby_caregivers
      where baby_id = diapers.baby_id and user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- SLEEPS
-- ─────────────────────────────────────────────
create table if not exists public.sleeps (
  id uuid primary key default uuid_generate_v4(),
  baby_id uuid references public.babies(id) on delete cascade not null,
  logged_by uuid references auth.users(id) on delete set null not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sleeps enable row level security;

create policy "Caregivers can manage sleeps"
  on public.sleeps for all
  using (
    exists (
      select 1 from public.baby_caregivers
      where baby_id = sleeps.baby_id and user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- ALARMS
-- ─────────────────────────────────────────────
create table if not exists public.alarms (
  id uuid primary key default uuid_generate_v4(),
  baby_id uuid references public.babies(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('feeding', 'diaper', 'sleep', 'custom')),
  label text not null,
  interval_minutes integer,
  next_due_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.alarms enable row level security;

create policy "Caregivers can manage alarms"
  on public.alarms for all
  using (
    exists (
      select 1 from public.baby_caregivers
      where baby_id = alarms.baby_id and user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- STORAGE BUCKET for baby photos
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('baby-photos', 'baby-photos', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload baby photos"
  on storage.objects for insert
  with check (bucket_id = 'baby-photos' and auth.role() = 'authenticated');

create policy "Anyone can view baby photos"
  on storage.objects for select
  using (bucket_id = 'baby-photos');

create policy "Authenticated users can update baby photos"
  on storage.objects for update
  with check (bucket_id = 'baby-photos' and auth.role() = 'authenticated');
