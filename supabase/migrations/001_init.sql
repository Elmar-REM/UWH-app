-- Accounts, subscription state and saved plays for UWH Tactics.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plan text not null default 'free',            -- 'free' or 'pro'
  subscription_status text not null default 'none',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.plays (
  id text primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled play',
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists plays_owner_idx on public.plays (owner, updated_at desc);

alter table public.profiles enable row level security;
alter table public.plays enable row level security;

-- Users can read their own profile. Only the server (service role, used by the
-- Stripe webhook) can change plan or subscription fields.
create policy "read own profile" on public.profiles for select using (auth.uid() = id);

-- Cloud saves are a paid feature: only active subscribers can write.
create or replace function public.is_pro(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = uid and plan = 'pro' and subscription_status in ('active', 'trialing')
  );
$$;

create policy "read own plays" on public.plays for select using (auth.uid() = owner);
create policy "pro users insert" on public.plays for insert with check (auth.uid() = owner and public.is_pro(auth.uid()));
create policy "pro users update" on public.plays for update using (auth.uid() = owner and public.is_pro(auth.uid()));
create policy "delete own plays" on public.plays for delete using (auth.uid() = owner);

-- Create a profile row for every new sign up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
