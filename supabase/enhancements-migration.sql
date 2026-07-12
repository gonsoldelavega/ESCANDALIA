-- ==========================================================================
-- enhancements-migration.sql — Columnas y tablas para las nuevas funciones.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de schema.sql y las demás
-- migraciones. Todo es idempotente (IF NOT EXISTS).
-- ==========================================================================

-- ── Rentabilidad real (IVA, personal, gastos fijos) ──────────────────
alter table if exists businesses
  add column if not exists tax_rate            numeric default 0.10,
  add column if not exists labor_rate_per_hour numeric default 0,
  add column if not exists overhead_rate       numeric default 0;

-- ── Merma y fecha de actualización de ingredientes ───────────────────
alter table if exists ingredients
  add column if not exists waste      numeric default 0,
  add column if not exists updated_at timestamptz default now();

-- ── Minutos de elaboración por plato (coste de personal) ─────────────
alter table if exists dishes
  add column if not exists labor_minutes numeric default 0;

-- ── Multi-local con roles: miembros de un negocio ────────────────────
-- Cada negocio (business) actúa como un "local". Un usuario puede pertenecer a
-- varios negocios con distinto rol.
create table if not exists memberships (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'manager', 'kitchen')),
  created_at  timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists memberships_user_idx     on memberships(user_id);
create index if not exists memberships_business_idx on memberships(business_id);

alter table memberships enable row level security;

-- El usuario ve sus propias membresías.
drop policy if exists memberships_select_own on memberships;
create policy memberships_select_own on memberships
  for select using (user_id = auth.uid());

-- Solo el dueño de un negocio gestiona sus membresías.
drop policy if exists memberships_manage_owner on memberships;
create policy memberships_manage_owner on memberships
  for all using (
    exists (
      select 1 from memberships m
      where m.business_id = memberships.business_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- Al crear un negocio, conviene registrar al creador como owner:
--   insert into memberships (business_id, user_id, role)
--   values (:new_business_id, auth.uid(), 'owner');

-- Nota: las políticas RLS de dishes/ingredients/etc. pueden ampliarse para
-- permitir acceso a cualquier miembro del negocio (no solo al owner_id),
-- comprobando la pertenencia vía la tabla memberships.
