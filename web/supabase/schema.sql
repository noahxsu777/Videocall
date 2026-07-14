-- =====================================================================
-- LiveStream — Supabase schema
-- Run this once in your Supabase project:
--   Dashboard → SQL Editor → New query → paste all of this → Run.
-- Also create a public Storage bucket named "media" (see bottom).
-- =====================================================================

-- ---------- profiles ----------
-- One row per user (mirrors auth.users). Holds the public profile.
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique,
  display_name    text,
  bio             text default '',
  avatar_url      text,
  name_updated_at timestamptz,
  vip_until       timestamptz,
  created_at      timestamptz not null default now()
);

-- Safe for existing projects: add the columns if the table already existed.
alter table public.profiles
  add column if not exists name_updated_at timestamptz;
alter table public.profiles
  add column if not exists vip_until timestamptz;

alter table public.profiles enable row level security;

-- Everyone can read profiles; you can only write your own.
drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    split_part(new.email, '@', 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- follows ----------
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id)
);

alter table public.follows enable row level security;

drop policy if exists "follows are viewable by everyone" on public.follows;
create policy "follows are viewable by everyone"
  on public.follows for select using (true);

drop policy if exists "users can follow" on public.follows;
create policy "users can follow"
  on public.follows for insert with check (auth.uid() = follower_id);

drop policy if exists "users can unfollow" on public.follows;
create policy "users can unfollow"
  on public.follows for delete using (auth.uid() = follower_id);

-- ---------- photos ----------
create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  image_url  text not null,
  caption    text default '',
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

drop policy if exists "photos are viewable by everyone" on public.photos;
create policy "photos are viewable by everyone"
  on public.photos for select using (true);

drop policy if exists "users can add own photos" on public.photos;
create policy "users can add own photos"
  on public.photos for insert with check (auth.uid() = user_id);

drop policy if exists "users can delete own photos" on public.photos;
create policy "users can delete own photos"
  on public.photos for delete using (auth.uid() = user_id);

-- ---------- messages (chat 1 a 1) ----------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content      text not null default '',
  kind         text not null default 'text', -- 'text' | 'call'
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists messages_participants_idx
  on public.messages (sender_id, recipient_id, created_at desc);
create index if not exists messages_recipient_idx
  on public.messages (recipient_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "participants can read messages" on public.messages;
create policy "participants can read messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "users can send messages" on public.messages;
create policy "users can send messages"
  on public.messages for insert with check (auth.uid() = sender_id);

drop policy if exists "recipients can mark read" on public.messages;
create policy "recipients can mark read"
  on public.messages for update using (auth.uid() = recipient_id);

-- Realtime: entrega mensajes al instante (si falla porque ya estaba
-- agregado, se ignora).
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when others then null; end $$;

-- =====================================================================
-- STORAGE: not required. Avatars and photos are compressed on the client
-- and stored inline as data URLs in the columns above, so you do NOT need
-- to create a "media" bucket. Just run this SQL and you're done.
-- =====================================================================
