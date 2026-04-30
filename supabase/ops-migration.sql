-- Escandalia migration: compras, ventas y caja diaria
-- Run this in Supabase SQL Editor for existing projects.
-- Safe to run more than once.

alter table public.ingredients add column if not exists normalized_name text;

update public.ingredients
set normalized_name = lower(regexp_replace(translate(name, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '[^a-zA-Z0-9]+', ' ', 'g'))
where normalized_name is null;

create unique index if not exists ingredients_business_normalized_name_idx
on public.ingredients(business_id, normalized_name);

create table if not exists public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  product_name text not null,
  normalized_name text not null,
  quantity numeric(12,4) not null check (quantity > 0),
  unit text not null,
  total_cost numeric(12,4) not null check (total_cost >= 0),
  unit_cost numeric(12,5) generated always as (total_cost / quantity) stored,
  supplier text,
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  dish_id uuid references public.dishes(id) on delete set null,
  dish_name text not null,
  sale_format text not null default 'tapa',
  quantity numeric(12,2) not null check (quantity > 0),
  day date not null default current_date,
  time_slot text not null default 'Comida',
  created_at timestamptz not null default now()
);

create table if not exists public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  day date not null default current_date,
  time_slot text,
  cash_total numeric(12,2) not null check (cash_total >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (business_id, day, time_slot)
);

create index if not exists purchase_lines_business_date_idx on public.purchase_lines(business_id, purchased_at desc);
create index if not exists sales_lines_business_day_idx on public.sales_lines(business_id, day desc, time_slot);
create index if not exists cash_closings_business_day_idx on public.cash_closings(business_id, day desc);

alter table public.purchase_lines enable row level security;
alter table public.sales_lines enable row level security;
alter table public.cash_closings enable row level security;

drop policy if exists "Users manage purchases for own businesses" on public.purchase_lines;
create policy "Users manage purchases for own businesses" on public.purchase_lines
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

drop policy if exists "Users manage sales for own businesses" on public.sales_lines;
create policy "Users manage sales for own businesses" on public.sales_lines
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

drop policy if exists "Users manage cash closings for own businesses" on public.cash_closings;
create policy "Users manage cash closings for own businesses" on public.cash_closings
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
