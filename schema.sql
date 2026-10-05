-- ============================================================================
-- ISEL · Plan de Desarrollo Comercial
-- Esquema completo: tablas, funciones de permisos y políticas de acceso.
--
-- Esta es la versión que ya está aplicada en el proyecto "ISEL - PDI"
-- (dezzafcyjbcxcgrqezkp). Se conserva aquí como referencia y para poder
-- levantar el sistema en otro proyecto de Supabase si alguna vez hace falta.
--
-- Todo lleva el prefijo pdc_ para convivir con otros proyectos en el mismo
-- Supabase sin tocar lo que ya existe.
-- ============================================================================

create schema if not exists private;

-- ============================================================================
-- TABLAS
-- ============================================================================

create table if not exists public.pdc_profiles (
  id        uuid primary key references auth.users on delete cascade,
  email     text,
  nombre    text,
  rol       text not null default 'colaborador'
            check (rol in ('admin','mentor','colaborador')),
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

-- La configuración del programa de cada persona vive en columnas jsonb para
-- que el mentor pueda editar objetivos y metas sin migraciones de esquema.
create table if not exists public.pdc_colaboradores (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  edad           int,
  puesto_actual  text,
  puesto_deseado text,
  email          text,
  telefono       text,
  sucursal       text,
  fecha_inicio   date,
  notas          text,
  estado         text not null default 'activo'
                 check (estado in ('activo','archivado','graduado')),
  mentor_id      uuid references public.pdc_profiles(id) on delete set null,
  user_id        uuid references public.pdc_profiles(id) on delete set null,
  semana_actual  int not null default 1,
  plan           jsonb not null default '[]'::jsonb,
  grupos         jsonb not null default '[]'::jsonb,
  competencias   jsonb not null default '[]'::jsonb,
  kpis           jsonb not null default '[]'::jsonb,
  criterios      jsonb not null default '[]'::jsonb,
  plan_visitas   jsonb not null default '[]'::jsonb,
  etapas         jsonb not null default '[]'::jsonb,
  riesgos        jsonb not null default '[]'::jsonb,
  examen         jsonb not null default '[]'::jsonb,
  juicio         jsonb not null default '{}'::jsonb,
  creado_por     uuid references public.pdc_profiles(id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists pdc_col_mentor_idx on public.pdc_colaboradores (mentor_id);
create index if not exists pdc_col_user_idx   on public.pdc_colaboradores (user_id);
create index if not exists pdc_col_estado_idx on public.pdc_colaboradores (estado);

create table if not exists public.pdc_plan_avance (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.pdc_colaboradores(id) on delete cascade,
  semana_id      text not null,
  tarea_id       text not null,
  hecho          boolean not null default false,
  evidencia      text,
  nota           text,
  actualizado_en timestamptz not null default now(),
  unique (colaborador_id, tarea_id)
);
create index if not exists pdc_avance_col_idx on public.pdc_plan_avance (colaborador_id);

create table if not exists public.pdc_kpi_resultados (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.pdc_colaboradores(id) on delete cascade,
  kpi_id         text not null,
  mes            int  not null check (mes between 1 and 12),
  valor          numeric not null default 0,
  validado       boolean not null default false,
  validado_por   uuid references public.pdc_profiles(id) on delete set null,
  actualizado_en timestamptz not null default now(),
  unique (colaborador_id, kpi_id, mes)
);
create index if not exists pdc_kpi_col_idx on public.pdc_kpi_resultados (colaborador_id);

create table if not exists public.pdc_evaluaciones (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.pdc_colaboradores(id) on delete cascade,
  competencia_id text not null,
  corte          text not null,
  nivel          int  not null check (nivel between 0 and 5),
  comentario     text,
  evaluador_id   uuid references public.pdc_profiles(id) on delete set null,
  fecha          timestamptz not null default now(),
  unique (colaborador_id, competencia_id, corte)
);
create index if not exists pdc_eval_col_idx on public.pdc_evaluaciones (colaborador_id);

create table if not exists public.pdc_visitas (
  id                uuid primary key default gen_random_uuid(),
  colaborador_id    uuid not null references public.pdc_colaboradores(id) on delete cascade,
  fecha             date,
  mes               int default 1,
  empresa           text,
  planta            text,
  tipo              text default 'acompanado',
  cuenta_nueva      boolean default false,
  objetivo          text,
  contactos         text,
  hallazgos         text,
  pains             text,
  aplicaciones      text,
  impacto           text,
  stakeholders      text,
  competencia       text,
  oportunidades     text,
  prox_accion       text,
  fecha_prox        date,
  calidad           int default 0,
  validada          boolean default false,
  comentario_mentor text,
  creado_en         timestamptz not null default now()
);
create index if not exists pdc_vis_col_idx on public.pdc_visitas (colaborador_id);

create table if not exists public.pdc_oportunidades (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.pdc_colaboradores(id) on delete cascade,
  nombre         text,
  cuenta         text,
  aplicacion     text,
  valor          numeric default 0,
  etapa          text default 'nueva',
  probabilidad   int default 10,
  cierre         date,
  decisor        text,
  competencia    text,
  presupuesto    text,
  timing         text,
  riesgos        text,
  prox_accion    text,
  fecha_prox     date,
  origen         text default 'creada',
  checks         jsonb not null default '{}'::jsonb,
  creado_en      timestamptz not null default now()
);
create index if not exists pdc_opp_col_idx on public.pdc_oportunidades (colaborador_id);

create table if not exists public.pdc_cuentas (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.pdc_colaboradores(id) on delete cascade,
  empresa        text,
  sector         text,
  plantas        text,
  procesos       text,
  tecnologias    text,
  competidores   text,
  relacion       text,
  proyectos      text,
  potencial      numeric default 0,
  riesgos        text,
  entrada        text,
  crecimiento    text,
  acciones       text,
  madurez        int default 1,
  aprobado       boolean default false,
  stakeholders   jsonb not null default '[]'::jsonb,
  creado_en      timestamptz not null default now()
);
create index if not exists pdc_cta_col_idx on public.pdc_cuentas (colaborador_id);

create table if not exists public.pdc_coaching (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.pdc_colaboradores(id) on delete cascade,
  fecha          date,
  tipo           text,
  logros         text,
  brechas        text,
  acuerdos       text,
  siguiente      text,
  nota           int default 0,
  autor_id       uuid references public.pdc_profiles(id) on delete set null,
  creado_en      timestamptz not null default now()
);
create index if not exists pdc_coach_col_idx on public.pdc_coaching (colaborador_id);

create table if not exists public.pdc_plantilla (
  id              int primary key default 1 check (id = 1),
  contenido       jsonb not null default '{}'::jsonb,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references public.pdc_profiles(id) on delete set null
);
insert into public.pdc_plantilla (id, contenido)
  values (1, '{}'::jsonb) on conflict (id) do nothing;

-- ============================================================================
-- ALTA AUTOMÁTICA DE PERFILES
-- ============================================================================

create or replace function public.pdc_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pdc_profiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'colaborador')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create or replace trigger pdc_on_auth_user_created
  after insert on auth.users
  for each row execute function public.pdc_nuevo_usuario();

-- No debe poder invocarse desde la API REST.
revoke execute on function public.pdc_nuevo_usuario() from public, anon, authenticated;

-- ============================================================================
-- FUNCIONES DE PERMISOS
--
-- Viven en el esquema privado, así que nadie puede llamarlas desde la API.
-- Las que devuelven conjuntos se evalúan una sola vez por consulta, no una vez
-- por renglón, que es lo que mantiene rápidas las políticas.
-- ============================================================================

create or replace function private.pdc_rol()
returns text language sql stable security definer set search_path = '' as $$
  select rol from public.pdc_profiles
   where id = (select auth.uid()) and activo = true
$$;

create or replace function private.pdc_es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.pdc_rol() = 'admin', false)
$$;

-- Expedientes que la persona puede LEER
create or replace function private.pdc_cols_lectura()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.pdc_colaboradores c
   where private.pdc_rol() in ('admin','mentor')
      or c.user_id = (select auth.uid())
$$;

-- Expedientes sobre los que puede EVALUAR y EDITAR el programa
create or replace function private.pdc_cols_mentor()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.pdc_colaboradores c
   where private.pdc_es_admin()
      or (private.pdc_rol() = 'mentor' and c.mentor_id = (select auth.uid()))
$$;

-- Expedientes donde puede REGISTRAR actividad (los suyos y los que mentorea)
create or replace function private.pdc_cols_captura()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.pdc_colaboradores c
   where private.pdc_es_admin()
      or (private.pdc_rol() = 'mentor' and c.mentor_id = (select auth.uid()))
      or c.user_id = (select auth.uid())
$$;

-- Las políticas se evalúan con los privilegios de quien consulta, así que el
-- rol `authenticated` necesita poder ejecutar estas funciones. La protección
-- real es que el esquema `private` no está expuesto en la API de PostgREST:
-- nadie puede llamarlas desde fuera de la base de datos. El rol anónimo
-- (sin sesión iniciada) no tiene acceso alguno al esquema.
grant usage on schema private to authenticated;

grant execute on function private.pdc_rol()          to authenticated;
grant execute on function private.pdc_es_admin()     to authenticated;
grant execute on function private.pdc_cols_lectura() to authenticated;
grant execute on function private.pdc_cols_mentor()  to authenticated;
grant execute on function private.pdc_cols_captura() to authenticated;

revoke all on schema private from anon;

-- ============================================================================
-- POLÍTICAS DE ACCESO
-- ============================================================================

alter table public.pdc_profiles       enable row level security;
alter table public.pdc_colaboradores  enable row level security;
alter table public.pdc_plan_avance    enable row level security;
alter table public.pdc_kpi_resultados enable row level security;
alter table public.pdc_evaluaciones   enable row level security;
alter table public.pdc_visitas        enable row level security;
alter table public.pdc_oportunidades  enable row level security;
alter table public.pdc_cuentas        enable row level security;
alter table public.pdc_coaching       enable row level security;
alter table public.pdc_plantilla      enable row level security;

-- Perfiles: todos ven la lista (la app muestra quién es mentor de quién).
-- Nadie puede cambiar su propio rol.
create policy pdc_prof_sel on public.pdc_profiles
  for select to authenticated using (true);

create policy pdc_prof_upd_propio on public.pdc_profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and rol = (select private.pdc_rol()));

create policy pdc_prof_admin on public.pdc_profiles
  for all to authenticated
  using ((select private.pdc_es_admin()))
  with check ((select private.pdc_es_admin()));

-- Colaboradores
create policy pdc_col_sel on public.pdc_colaboradores
  for select to authenticated
  using (id in (select private.pdc_cols_lectura()));

create policy pdc_col_ins on public.pdc_colaboradores
  for insert to authenticated
  with check (
    (select private.pdc_es_admin())
    or ((select private.pdc_rol()) = 'mentor' and mentor_id = (select auth.uid()))
  );

create policy pdc_col_upd on public.pdc_colaboradores
  for update to authenticated
  using (id in (select private.pdc_cols_mentor()))
  with check (id in (select private.pdc_cols_mentor()));

create policy pdc_col_del on public.pdc_colaboradores
  for delete to authenticated
  using ((select private.pdc_es_admin()));

-- Avance del plan: el colaborador marca sus tareas; el mentor también puede.
create policy pdc_av_sel on public.pdc_plan_avance
  for select to authenticated
  using (colaborador_id in (select private.pdc_cols_lectura()));

create policy pdc_av_esc on public.pdc_plan_avance
  for all to authenticated
  using (colaborador_id in (select private.pdc_cols_captura()))
  with check (colaborador_id in (select private.pdc_cols_captura()));

-- Resultados de indicadores: el colaborador captura el número pero no puede
-- marcarlo como validado, y una vez validado por el mentor queda fijo.
create policy pdc_kpi_sel on public.pdc_kpi_resultados
  for select to authenticated
  using (colaborador_id in (select private.pdc_cols_lectura()));

create policy pdc_kpi_mentor on public.pdc_kpi_resultados
  for all to authenticated
  using (colaborador_id in (select private.pdc_cols_mentor()))
  with check (colaborador_id in (select private.pdc_cols_mentor()));

create policy pdc_kpi_propio on public.pdc_kpi_resultados
  for all to authenticated
  using (colaborador_id in (select private.pdc_cols_captura()) and validado = false)
  with check (colaborador_id in (select private.pdc_cols_captura()) and validado = false);

-- Evaluaciones: solo las escribe el mentor. El colaborador las consulta.
create policy pdc_eval_sel on public.pdc_evaluaciones
  for select to authenticated
  using (colaborador_id in (select private.pdc_cols_lectura()));

create policy pdc_eval_esc on public.pdc_evaluaciones
  for all to authenticated
  using (colaborador_id in (select private.pdc_cols_mentor()))
  with check (colaborador_id in (select private.pdc_cols_mentor()));

-- Visitas, oportunidades y cuentas: las registra el colaborador,
-- el mentor puede corregirlas.
create policy pdc_vis_sel on public.pdc_visitas
  for select to authenticated
  using (colaborador_id in (select private.pdc_cols_lectura()));

create policy pdc_vis_esc on public.pdc_visitas
  for all to authenticated
  using (colaborador_id in (select private.pdc_cols_captura()))
  with check (colaborador_id in (select private.pdc_cols_captura()));

create policy pdc_opp_sel on public.pdc_oportunidades
  for select to authenticated
  using (colaborador_id in (select private.pdc_cols_lectura()));

create policy pdc_opp_esc on public.pdc_oportunidades
  for all to authenticated
  using (colaborador_id in (select private.pdc_cols_captura()))
  with check (colaborador_id in (select private.pdc_cols_captura()));

create policy pdc_cta_sel on public.pdc_cuentas
  for select to authenticated
  using (colaborador_id in (select private.pdc_cols_lectura()));

create policy pdc_cta_esc on public.pdc_cuentas
  for all to authenticated
  using (colaborador_id in (select private.pdc_cols_captura()))
  with check (colaborador_id in (select private.pdc_cols_captura()));

-- Coaching
create policy pdc_coach_sel on public.pdc_coaching
  for select to authenticated
  using (colaborador_id in (select private.pdc_cols_lectura()));

create policy pdc_coach_esc on public.pdc_coaching
  for all to authenticated
  using (colaborador_id in (select private.pdc_cols_mentor()))
  with check (colaborador_id in (select private.pdc_cols_mentor()));

-- Plantilla base
create policy pdc_plt_sel on public.pdc_plantilla
  for select to authenticated using (true);

create policy pdc_plt_esc on public.pdc_plantilla
  for all to authenticated
  using ((select private.pdc_es_admin()))
  with check ((select private.pdc_es_admin()));

-- ============================================================================
-- PRIMER ADMINISTRADOR
--
-- Después de crear tu usuario en Authentication → Users, ejecuta esto con tu
-- correo para poder entrar como administrador:
--
--   update public.pdc_profiles set rol = 'admin' where email = 'tu@correo.com';
-- ============================================================================
