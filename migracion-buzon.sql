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
