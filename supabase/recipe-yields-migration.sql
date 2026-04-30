-- Escandalia migration: receta base -> rendimiento -> formatos de venta
-- Run this in Supabase SQL Editor for existing projects.

alter table public.dishes add column if not exists yield_unit text not null default 'tapas_base';
alter table public.dishes add column if not exists sale_formats jsonb not null default '[{"id":"tapa","name":"Tapa","portions":1,"pvp":0},{"id":"media","name":"Media racion","portions":2.5,"pvp":0},{"id":"racion","name":"Racion","portions":4,"pvp":0}]'::jsonb;

update public.dishes
set sale_formats = jsonb_build_array(
  jsonb_build_object('id', 'tapa', 'name', 'Tapa', 'portions', 1, 'pvp', pvp),
  jsonb_build_object('id', 'media', 'name', 'Media racion', 'portions', 2.5, 'pvp', round((pvp * 2.2)::numeric, 2)),
  jsonb_build_object('id', 'racion', 'name', 'Racion', 'portions', 4, 'pvp', round((pvp * 3.5)::numeric, 2))
)
where sale_formats is null
   or sale_formats = '[{"id":"tapa","name":"Tapa","portions":1,"pvp":0},{"id":"media","name":"Media racion","portions":2.5,"pvp":0},{"id":"racion","name":"Racion","portions":4,"pvp":0}]'::jsonb;

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
