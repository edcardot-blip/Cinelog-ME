-- 003_user_prefs.sql
-- Per-user app preferences (currently: streaming-service selection + freeOnly flag).
-- One row per user, RLS-scoped to auth.uid(). Run in the Supabase SQL editor.
--
-- The app works WITHOUT this table (it falls back to localStorage), but running this
-- migration enables cross-device persistence of a user's streaming subscriptions.

create table if not exists public.user_prefs (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  streaming_services jsonb       not null default '[]'::jsonb,  -- array of service keys, e.g. ["netflix","hbo"]
  free_only          boolean     not null default false,
  updated_at         timestamptz not null default now()
);

alter table public.user_prefs enable row level security;

-- A user may read only their own row.
create policy "user_prefs_select_own"
  on public.user_prefs for select
  using (auth.uid() = user_id);

-- A user may insert only a row keyed to themselves.
create policy "user_prefs_insert_own"
  on public.user_prefs for insert
  with check (auth.uid() = user_id);

-- A user may update only their own row.
create policy "user_prefs_update_own"
  on public.user_prefs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- (Optional) allow a user to delete their own row.
create policy "user_prefs_delete_own"
  on public.user_prefs for delete
  using (auth.uid() = user_id);
