-- ============ ROLES & PROFILES ============
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.update_updated_at_column();

-- profile policies
create policy "Profiles viewable by self" on public.profiles for select using (auth.uid() = user_id);
create policy "Profiles updatable by self" on public.profiles for update using (auth.uid() = user_id);

-- user_roles policies
create policy "Users see own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "Admins see all roles" on public.user_roles for select using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ KNOWLEDGE TABLES ============
create table public.lenders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ae_name text,
  ae_email text,
  ae_phone text,
  website text,
  states_licensed text[] not null default '{}',
  reputation_notes text,
  avg_turn_time_days int,
  niche_advantages text,
  internal_experience text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.loan_programs (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references public.lenders(id) on delete cascade,
  product_name text not null,
  loan_program text,
  product_type text,
  min_fico int,
  max_ltv numeric,
  max_dti numeric,
  reserve_months int,
  occupancies text[] not null default '{}',
  property_types text[] not null default '{}',
  income_types text[] not null default '{}',
  loan_types text[] not null default '{}',
  states text[] not null default '{}',
  min_loan_amount numeric,
  max_loan_amount numeric,
  seasoning_months int,
  bk_seasoning_months int,
  fc_seasoning_months int,
  dscr_min numeric,
  foreign_national_eligible boolean not null default false,
  itin_eligible boolean not null default false,
  dpa_available boolean not null default false,
  dpa_min_fico int,
  gift_funds_allowed boolean not null default false,
  exception_policy text,
  niche_advantages text,
  competitive_advantages text,
  special_programs text[] not null default '{}',
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.overlays (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid references public.lenders(id) on delete cascade,
  program_id uuid references public.loan_programs(id) on delete cascade,
  overlay_type text not null,
  description text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.ae_notes (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references public.lenders(id) on delete cascade,
  note text not null,
  category text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.raw_intel (
  id uuid primary key default gen_random_uuid(),
  source_label text,
  raw_text text not null,
  extraction jsonb,
  status text not null default 'pending',
  lender_id uuid references public.lenders(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.lenders enable row level security;
alter table public.loan_programs enable row level security;
alter table public.overlays enable row level security;
alter table public.ae_notes enable row level security;
alter table public.raw_intel enable row level security;

create trigger lenders_updated_at before update on public.lenders for each row execute function public.update_updated_at_column();
create trigger loan_programs_updated_at before update on public.loan_programs for each row execute function public.update_updated_at_column();

-- read: any authenticated user
create policy "Authenticated read lenders" on public.lenders for select to authenticated using (true);
create policy "Authenticated read programs" on public.loan_programs for select to authenticated using (true);
create policy "Authenticated read overlays" on public.overlays for select to authenticated using (true);
create policy "Authenticated read ae_notes" on public.ae_notes for select to authenticated using (true);
create policy "Authenticated read raw_intel" on public.raw_intel for select to authenticated using (true);

-- write: admins only
create policy "Admins manage lenders" on public.lenders for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage programs" on public.loan_programs for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage overlays" on public.overlays for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage ae_notes" on public.ae_notes for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage raw_intel" on public.raw_intel for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create index idx_loan_programs_lender on public.loan_programs(lender_id);
create index idx_overlays_lender on public.overlays(lender_id);
create index idx_overlays_program on public.overlays(program_id);
create index idx_ae_notes_lender on public.ae_notes(lender_id);
create index idx_raw_intel_status on public.raw_intel(status);