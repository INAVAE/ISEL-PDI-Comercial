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
  rol       text not null default 'colaborador',
  activo    boolean not null default true,
  -- Contraseña temporal pendiente de cambiar en el primer ingreso
  debe_cambiar boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint pdc_profiles_rol_valido
    check (rol in ('admin','mentor','colaborador','lector'))
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
  -- Término previsto. Vacío = se calcula desde fecha_inicio y el número de
  -- semanas del plan. Se define a mano para absorber pausas del programa.
  fecha_fin_prevista date,
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

-- El alta en Authentication NO otorga acceso a esta herramienta: la cuenta se
-- comparte con las demás aplicaciones de ISEL, y el acceso al plan de
-- desarrollo lo concede un administrador desde la pantalla de Usuarios.
-- El disparador se conserva sin efecto para no romper nada que dependa de él.
create or replace function public.pdc_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
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

-- Expedientes que la persona puede LEER. El rol de solo lectura ve todos.
create or replace function private.pdc_cols_lectura()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.pdc_colaboradores c
   where private.pdc_rol() in ('admin','mentor','lector')
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
--
-- Importante: estas políticas NO consultan la propia tabla pdc_colaboradores.
-- Al hacer INSERT ... RETURNING, Postgres verifica la política de lectura
-- contra el renglón recién creado, y una subconsulta sobre la misma tabla usa
-- la foto anterior del dato y no lo encuentra: el alta se rechazaría con el
-- mensaje "new row violates row-level security policy". Por eso la condición
-- se evalúa sobre las columnas del propio renglón. Las subconsultas de rol se
-- siguen resolviendo una sola vez por consulta.
create policy pdc_col_sel on public.pdc_colaboradores
  for select to authenticated
  using (
    (select private.pdc_rol()) in ('admin','mentor','lector')
    or user_id = (select auth.uid())
  );

create policy pdc_col_ins on public.pdc_colaboradores
  for insert to authenticated
  with check (
    (select private.pdc_es_admin())
    or ((select private.pdc_rol()) = 'mentor' and mentor_id = (select auth.uid()))
  );

create policy pdc_col_upd on public.pdc_colaboradores
  for update to authenticated
  using (
    (select private.pdc_es_admin())
    or ((select private.pdc_rol()) = 'mentor' and mentor_id = (select auth.uid()))
  )
  with check (
    (select private.pdc_es_admin())
    or ((select private.pdc_rol()) = 'mentor' and mentor_id = (select auth.uid()))
  );

create policy pdc_col_del on public.pdc_colaboradores
  for delete to authenticated
  using ((select private.pdc_es_admin()));

-- En las tablas hijas sí se consulta pdc_colaboradores, que es una tabla
-- distinta de la que se está escribiendo, así que no hay ese problema y se
-- gana la ventaja de resolver el conjunto una sola vez por consulta.

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
-- NOTA SOBRE EL ROL DE SOLO LECTURA
--
-- El rol 'lector' aparece únicamente en las políticas de SELECT. Como no está
-- en pdc_cols_mentor() ni en pdc_cols_captura(), no alcanza ninguna política
-- de escritura: no puede insertar, modificar ni borrar nada en ninguna tabla.
-- ============================================================================

-- ============================================================================
-- PRIMER ADMINISTRADOR
--
-- Después de crear tu usuario en Authentication → Users, ejecuta esto con tu
-- correo para poder entrar como administrador:
--
--   update public.pdc_profiles set rol = 'admin' where email = 'tu@correo.com';
-- ============================================================================
-- ===========================================================================
-- ISEL · Plan de Desarrollo Comercial
-- Buzón de observaciones del centro de ayuda
--
-- Ejecutar completo en el SQL Editor del proyecto de Supabase.
-- Se puede correr dos veces sin que falle.
--
-- Para qué: que cualquiera del equipo reporte un error o pida un cambio sin
-- salir de la herramienta, y le llegue al administrador con el nombre de
-- quien lo manda. Lo que se dice de pasillo se pierde; esto queda escrito,
-- con fecha y con dueño.
-- ===========================================================================

create table if not exists public.pdc_sugerencias (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,

  -- El nombre y el correo se guardan tal como estaban al enviarla. Si la
  -- persona cambia de nombre o se da de baja, el reporte conserva de quién
  -- vino; sin esto quedarían observaciones huérfanas.
  autor        text not null,
  autor_email  text,
  rol          text,

  tipo         text not null default 'mejora'
               check (tipo in ('error','mejora','duda','otro')),
  pantalla     text,
  titulo       text not null,
  detalle      text not null,

  -- Navegador, tamaño de ventana y tema. Es lo primero que se pregunta al
  -- diagnosticar y lo que peor se recuerda.
  contexto     jsonb not null default '{}'::jsonb,

  estado       text not null default 'nueva'
               check (estado in ('nueva','en_revision','resuelta','descartada')),
  respuesta    text,
  atendida_por uuid,
  atendida_en  timestamptz,
  creado_en    timestamptz not null default now()
);

create index if not exists pdc_sugerencias_estado_idx
  on public.pdc_sugerencias (estado, creado_en desc);
create index if not exists pdc_sugerencias_autor_idx
  on public.pdc_sugerencias (user_id, creado_en desc);

alter table public.pdc_sugerencias enable row level security;

-- Las políticas se recrean con alter cuando ya existen: un drop dentro de
-- una migración hace que Supabase la marque como destructiva y la cancele.
do $pol$
begin
  -- Leer: la propia, o todas si eres administrador.
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'pdc_sugerencias'
                and policyname = 'pdc_sug_lee') then
    alter policy pdc_sug_lee on public.pdc_sugerencias
      using (user_id = (select auth.uid()) or private.pdc_es_admin());
  else
    create policy pdc_sug_lee on public.pdc_sugerencias
      for select to authenticated
      using (user_id = (select auth.uid()) or private.pdc_es_admin());
  end if;

  -- Escribir: solo a nombre propio, y solo si tienes rol activo aquí. El
  -- user_id no se acepta del cliente a ciegas: tiene que ser el tuyo.
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'pdc_sugerencias'
                and policyname = 'pdc_sug_escribe') then
    alter policy pdc_sug_escribe on public.pdc_sugerencias
      with check (user_id = (select auth.uid()) and private.pdc_rol() is not null);
  else
    create policy pdc_sug_escribe on public.pdc_sugerencias
      for insert to authenticated
      with check (user_id = (select auth.uid()) and private.pdc_rol() is not null);
  end if;

  -- Cambiar el estado o responder: solo el administrador.
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'pdc_sugerencias'
                and policyname = 'pdc_sug_atiende') then
    alter policy pdc_sug_atiende on public.pdc_sugerencias
      using (private.pdc_es_admin()) with check (private.pdc_es_admin());
  else
    create policy pdc_sug_atiende on public.pdc_sugerencias
      for update to authenticated
      using (private.pdc_es_admin()) with check (private.pdc_es_admin());
  end if;
end
$pol$;

-- Nadie borra observaciones: no hay política de delete, así que la tabla las
-- conserva. Una observación incómoda que se puede borrar no sirve de nada.
-- ===========================================================================
-- ISEL · Plan de Desarrollo Comercial
-- Nadie puede ser su propio mentor
--
-- Ejecutar completo en el SQL Editor del proyecto de Supabase.
-- Se puede correr dos veces sin que falle.
--
-- Para qué: a partir de ahora un mentor puede llevar su propio plan de
-- desarrollo con su misma cuenta, sin inventarle una segunda. Eso abre la
-- puerta de al lado: que alguien quede como mentor de sí mismo. Si lo fuera,
-- podría fijarse sus propias metas, calificarse las competencias y validar su
-- propia evidencia, que es justo lo que el programa no permite.
--
-- La aplicación ya lo impide al guardar. Esto lo impide también en la base,
-- que es donde tiene que estar: una regla que solo vive en la pantalla se
-- salta desde cualquier otro lado.
-- ===========================================================================

-- Primero, por si ya quedó alguno así registrado antes de esta regla.
-- Si esta consulta devuelve renglones, hay que asignarles otro mentor ANTES
-- de seguir: la restricción de abajo fallaría.
select id, nombre, 'se tiene como su propio mentor' as problema
  from public.pdc_colaboradores
 where mentor_id is not null and mentor_id = user_id;

-- Se agrega sin validar lo ya existente y luego se valida aparte, para que un
-- renglón viejo no cancele la migración entera sin decir cuál fue.
alter table public.pdc_colaboradores
  drop constraint if exists pdc_col_no_automentor;

alter table public.pdc_colaboradores
  add constraint pdc_col_no_automentor
  check (mentor_id is null or user_id is null or mentor_id <> user_id)
  not valid;

alter table public.pdc_colaboradores
  validate constraint pdc_col_no_automentor;

comment on constraint pdc_col_no_automentor on public.pdc_colaboradores is
  'Un mentor puede estar en desarrollo con su propia cuenta, pero no puede ser su propio mentor: se fijaría sus metas y validaría su propia evidencia.';
-- ===========================================================================
-- ISEL · Plan de Desarrollo Comercial
-- Archivos de evidencia en las listas de verificación
--
-- Ejecutar completo en el SQL Editor del proyecto de Supabase.
-- Se puede correr dos veces sin que falle.
--
-- Para qué: que en cada tarea de la semana se pueda adjuntar un archivo —la
-- foto del tablero, el PDF de la cotización, el Excel del levantamiento— en
-- vez de una liga que se rompe en cuanto alguien mueve la carpeta.
-- ===========================================================================

-- 1 · Dónde se anota qué archivos trae cada tarea -------------------------
-- La ruta, no una liga: una liga firmada caduca a los minutos.
alter table public.pdc_plan_avance
  add column if not exists archivos jsonb not null default '[]'::jsonb;

comment on column public.pdc_plan_avance.archivos is
  'Archivos de evidencia de la tarea: [{ruta, nombre, tipo, bytes, subido_en}]. La ruta apunta al depósito pdc-evidencias.';

-- 2 · El depósito ---------------------------------------------------------
-- Privado: nada se abre con la sola dirección, hace falta una liga firmada
-- que la aplicación pide en el momento y vale unos minutos.
insert into storage.buckets (id, name, public, file_size_limit)
values ('pdc-evidencias', 'pdc-evidencias', false, 10485760)
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760;

-- 3 · Quién puede qué -----------------------------------------------------
-- La primera carpeta de la ruta es el id del colaborador:
--     <colaborador_id>/<tarea_id>/<momento>-<nombre>
-- así que las políticas reusan los mismos permisos que el resto de la
-- herramienta, sin inventar reglas nuevas:
--     leer     → private.pdc_cols_lectura()   (lo que ya puede ver)
--     escribir → private.pdc_cols_captura()   (lo que ya puede capturar)
--
-- El id se compara como texto contra el uuid convertido a texto. Hacerlo al
-- revés —convertir la carpeta a uuid— revienta con cualquier ruta que no sea
-- un uuid, y basta un archivo suelto para tumbar la consulta entera.

do $pol$
declare
  nombres text[] := array['pdc_evid_lee','pdc_evid_sube','pdc_evid_actualiza','pdc_evid_borra'];
  n text;
begin
  foreach n in array nombres loop
    if exists (select 1 from pg_policies
                where schemaname = 'storage' and tablename = 'objects' and policyname = n) then
      execute format('drop policy %I on storage.objects', n);
    end if;
  end loop;

  create policy pdc_evid_lee on storage.objects
    for select to authenticated
    using (
      bucket_id = 'pdc-evidencias'
      and (storage.foldername(name))[1] in (
        select c::text from private.pdc_cols_lectura() c
      )
    );

  create policy pdc_evid_sube on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'pdc-evidencias'
      and (storage.foldername(name))[1] in (
        select c::text from private.pdc_cols_captura() c
      )
    );

  create policy pdc_evid_actualiza on storage.objects
    for update to authenticated
    using (
      bucket_id = 'pdc-evidencias'
      and (storage.foldername(name))[1] in (
        select c::text from private.pdc_cols_captura() c
      )
    )
    with check (
      bucket_id = 'pdc-evidencias'
      and (storage.foldername(name))[1] in (
        select c::text from private.pdc_cols_captura() c
      )
    );

  create policy pdc_evid_borra on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'pdc-evidencias'
      and (storage.foldername(name))[1] in (
        select c::text from private.pdc_cols_captura() c
      )
    );
end
$pol$;

-- 4 · Comprobación --------------------------------------------------------
-- Debe devolver cuatro renglones.
select policyname, cmd
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname like 'pdc_evid_%'
 order by policyname;

-- Nota sobre el espacio: el plan gratuito de Supabase da 1 GB de
-- almacenamiento. Con fotos de celular de 2 a 4 MB alcanza para unos
-- trescientos archivos. Cuando se acerque, conviene revisar el plan o
-- limpiar los expedientes ya graduados.


-- ===========================================================================
-- ISEL · Plan de Desarrollo Comercial
-- Configuración de los recordatorios por correo
--
-- Hasta ahora los días estaban escritos en el flujo de GitHub y el correo lo
-- recibía todo colaborador activo, sin manera de excluir a nadie ni de
-- incluir a quien no lleva un plan propio. Esto mueve las dos decisiones a la
-- base, para que el administrador las cambie desde la pantalla.
--
-- Ejecutar completo en el SQL Editor del proyecto de Supabase.
-- Se puede correr dos veces sin que falle.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- CUÁNDO SE ENVÍA
-- ---------------------------------------------------------------------------
-- Un solo renglón, igual que la plantilla base. La hora se guarda en la zona
-- que indica el campo, no en UTC: lo que el administrador eligió es «las 7:35
-- de la mañana», y a esa hora tiene que llegar aunque México cambie de huso.
create table if not exists public.pdc_recordatorios (
  id       int primary key default 1 check (id = 1),
  activo   boolean not null default true,
  -- Días en la convención de JavaScript: 0 domingo … 6 sábado
  dias     smallint[] not null default '{1,4}',
  hora     smallint not null default 7  check (hora between 0 and 23),
  minuto   smallint not null default 35 check (minuto between 0 and 59),
  zona     text not null default 'America/Mexico_City',
  -- Fecha local del último envío. Evita que dos corridas del mismo día
  -- manden el correo dos veces, y permite recuperar un envío si GitHub
  -- retrasó la corrida de la hora elegida.
  ultimo_envio    date,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references public.pdc_profiles(id) on delete set null,
  -- array_length de un arreglo vacío es NULL, y en un CHECK el NULL pasa:
  -- de ahí el coalesce. Sin días no hay envío posible, y para eso ya está
  -- «activo»; un arreglo vacío sería un segundo apagador, mudo.
  constraint pdc_rec_dias_validos check (
    dias <@ array[0,1,2,3,4,5,6]::smallint[]
    and coalesce(array_length(dias, 1), 0) between 1 and 7
  )
);

insert into public.pdc_recordatorios (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- QUIÉN LO RECIBE
-- ---------------------------------------------------------------------------
-- Un renglón por persona, y cada renglón apunta a un colaborador o a un
-- perfil, nunca a los dos. Son dos cosas distintas:
--
--   colaborador_id → recibe el resumen de SU plan.
--   perfil_id      → recibe el panorama del equipo, sin plan propio. Es para
--                    quien solo observa: dirección, un rol de solo lectura.
--
-- Los valores que faltan tienen cada uno su default, y son distintos a
-- propósito:
--
--   Un colaborador SIN renglón recibe. Así, al dar de alta a alguien nuevo
--   nadie tiene que acordarse de encenderle el correo; para que no lo reciba
--   hay que decirlo.
--   Un perfil SIN renglón no recibe. Al revés sería mandarle a toda la
--   plantilla un correo que nadie pidió.
create table if not exists public.pdc_recordatorio_destinos (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid unique references public.pdc_colaboradores(id) on delete cascade,
  perfil_id      uuid unique references public.pdc_profiles(id)      on delete cascade,
  recibe         boolean not null default true,
  actualizado_en timestamptz not null default now(),
  constraint pdc_dest_uno_u_otro
    check ((colaborador_id is not null) <> (perfil_id is not null))
);

-- ---------------------------------------------------------------------------
-- ACCESO: SOLO EL ADMINISTRADOR
-- ---------------------------------------------------------------------------
-- Ni el mentor toca esto. Un mentor puede editar la ficha de su colaborador,
-- así que si la decisión viviera en esa ficha la tendría a su alcance sin
-- quererlo; en su propia tabla queda donde se dijo.
--
-- El envío corre con la llave de servicio, que se salta las políticas: estas
-- reglas son para la pantalla, no para el que manda los correos.
--
-- Las políticas se recrean con alter cuando ya existen: un drop dentro de una
-- migración hace que Supabase la marque como destructiva y la cancele.
alter table public.pdc_recordatorios          enable row level security;
alter table public.pdc_recordatorio_destinos  enable row level security;

do $pol$
begin
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'pdc_recordatorios'
                and policyname = 'pdc_rec_admin') then
    alter policy pdc_rec_admin on public.pdc_recordatorios
      using ((select private.pdc_es_admin()))
      with check ((select private.pdc_es_admin()));
  else
    create policy pdc_rec_admin on public.pdc_recordatorios
      for all to authenticated
      using ((select private.pdc_es_admin()))
      with check ((select private.pdc_es_admin()));
  end if;

  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'pdc_recordatorio_destinos'
                and policyname = 'pdc_dest_admin') then
    alter policy pdc_dest_admin on public.pdc_recordatorio_destinos
      using ((select private.pdc_es_admin()))
      with check ((select private.pdc_es_admin()));
  else
    create policy pdc_dest_admin on public.pdc_recordatorio_destinos
      for all to authenticated
      using ((select private.pdc_es_admin()))
      with check ((select private.pdc_es_admin()));
  end if;
end
$pol$;
