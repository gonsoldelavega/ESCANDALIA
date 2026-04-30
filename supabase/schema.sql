-- Escandalia Supabase schema
-- Run this file in Supabase SQL Editor once per project.

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  target_margin numeric(5,4) not null default 0.75 check (target_margin > 0 and target_margin < 1),
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  unit text not null,
  current_cost numeric(12,5) not null check (current_cost >= 0),
  previous_cost numeric(12,5) check (previous_cost >= 0),
  supplier text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'Tapas',
  servings numeric(8,2) not null default 1 check (servings > 0),
  pvp numeric(10,2) not null check (pvp >= 0),
  published boolean not null default false,
  description text,
  allergens text,
  image_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

-- Existing projects can rerun this file. These columns support the real bar workflow:
-- recipe base -> yield -> sale formats (tapa, media racion, racion, menu, etc.).
alter table public.dishes add column if not exists yield_unit text not null default 'tapas_base';
alter table public.dishes add column if not exists sale_formats jsonb not null default '[{"id":"tapa","name":"Tapa","portions":1,"pvp":0},{"id":"media","name":"Media racion","portions":2.5,"pvp":0},{"id":"racion","name":"Racion","portions":4,"pvp":0}]'::jsonb;

create table if not exists public.dish_ingredients (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(12,4) not null check (quantity > 0),
  sort_order integer not null default 0,
  unique (dish_id, ingredient_id)
);

create table if not exists public.menu_languages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  language_code text not null check (char_length(language_code) between 2 and 8),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, language_code)
);

create table if not exists public.dish_translations (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes(id) on delete cascade,
  language_code text not null,
  translated_name text,
  translated_description text,
  generated_by_ai boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (dish_id, language_code)
);

create table if not exists public.cost_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  previous_cost numeric(12,5) not null,
  current_cost numeric(12,5) not null,
  status text not null default 'open' check (status in ('open', 'ignored', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create or replace view public.dish_costs as
with recipe_costs as (
  select
    d.id as dish_id,
    d.business_id,
    d.name,
    d.category,
    d.servings,
    d.yield_unit,
    d.sale_formats,
    d.pvp,
    d.published,
    b.target_margin,
    coalesce(sum(di.quantity * i.current_cost), 0)::numeric(12,4) as base_recipe_cost
  from public.dishes d
  join public.businesses b on b.id = d.business_id
  left join public.dish_ingredients di on di.dish_id = d.id
  left join public.ingredients i on i.id = di.ingredient_id
  group by d.id, d.business_id, d.name, d.category, d.servings, d.yield_unit, d.sale_formats, d.pvp, d.published, b.target_margin
)
select
  dish_id,
  business_id,
  name,
  category,
  pvp,
  published,
  servings as base_yield_count,
  yield_unit,
  sale_formats,
  base_recipe_cost as cost_total,
  case when servings > 0 then (base_recipe_cost / servings)::numeric(12,4) else 0 end as cost_per_base_tapa,
  case when pvp > 0 and servings > 0 then ((pvp - (base_recipe_cost / servings)) / pvp)::numeric(8,4) else 0 end as gross_margin,
  case when servings > 0 then ceil(((base_recipe_cost / servings) / (1 - target_margin)) * 20) / 20 else 0 end::numeric(10,2) as recommended_pvp
from recipe_costs;

create index if not exists businesses_owner_id_idx on public.businesses(owner_id);
create index if not exists ingredients_business_id_idx on public.ingredients(business_id);
create index if not exists dishes_business_id_idx on public.dishes(business_id);
create index if not exists dishes_business_published_idx on public.dishes(business_id, published) where published = true;
create index if not exists dish_ingredients_dish_id_idx on public.dish_ingredients(dish_id);
create index if not exists dish_ingredients_ingredient_id_idx on public.dish_ingredients(ingredient_id);
create index if not exists cost_alerts_business_status_idx on public.cost_alerts(business_id, status, created_at desc);

alter table public.businesses enable row level security;
alter table public.ingredients enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_ingredients enable row level security;
alter table public.menu_languages enable row level security;
alter table public.dish_translations enable row level security;
alter table public.cost_alerts enable row level security;

create policy "Users manage own businesses" on public.businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Users manage ingredients for own businesses" on public.ingredients
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "Users manage dishes for own businesses" on public.dishes
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "Users manage recipe lines for own dishes" on public.dish_ingredients
  for all using (exists (
    select 1 from public.dishes d
    join public.businesses b on b.id = d.business_id
    where d.id = dish_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.dishes d
    join public.businesses b on b.id = d.business_id
    where d.id = dish_id and b.owner_id = auth.uid()
  ));

create policy "Users manage menu languages for own businesses" on public.menu_languages
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "Users manage translations for own dishes" on public.dish_translations
  for all using (exists (
    select 1 from public.dishes d
    join public.businesses b on b.id = d.business_id
    where d.id = dish_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.dishes d
    join public.businesses b on b.id = d.business_id
    where d.id = dish_id and b.owner_id = auth.uid()
  ));

create policy "Users manage alerts for own businesses" on public.cost_alerts
  for all using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
drop trigger if exists ingredients_set_updated_at on public.ingredients;
drop trigger if exists dishes_set_updated_at on public.dishes;
create trigger businesses_set_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger ingredients_set_updated_at before update on public.ingredients for each row execute function public.set_updated_at();
create trigger dishes_set_updated_at before update on public.dishes for each row execute function public.set_updated_at();
