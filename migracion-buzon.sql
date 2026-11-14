-- ===========================================================================
-- ISEL · Plan de Desarrollo Comercial
-- Buzón de observaciones del centro de ayuda, CON ARCHIVOS ADJUNTOS
--
-- YA APLICADA en el proyecto el 13/11/2026 (migración
-- "pdc_buzon_ayuda_con_adjuntos"). Se conserva aquí como referencia de lo
-- que quedó en la base. Se puede volver a correr sin que falle.
--
-- Para qué: que cualquiera del equipo reporte un error o pida un cambio sin
-- salir de la herramienta, adjuntando una captura, y le llegue al
-- administrador con el nombre de quien lo manda.
--
-- Qué quedó:
--   · tabla public.pdc_sugerencias, con columna archivos (jsonb)
--   · 3 políticas: cada quien lee las suyas, el administrador todas y es el
--     único que cambia estado o responde. No hay política de borrado a
--     propósito: una observación incómoda que se puede borrar no sirve.
--   · depósito privado storage "pdc-ayuda" con 3 políticas, ordenado por
--     quien reporta:  <user_id>/<momento>-<nombre>
--
-- Comprobado contra la base con ocho casos en una transacción que se
-- deshizo sola: que el autor vea la suya y guarde el adjunto, que no pueda
-- firmar como otro ni resolverla, que otro colaborador no la vea, que el
-- administrador sí la vea y la resuelva, y que nadie pueda borrarla.
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

  -- Capturas o archivos que adjunta quien reporta:
  -- [{ruta, nombre, tipo, bytes, subido_en}]. Se guarda la RUTA, no una liga:
  -- una liga firmada caduca a los minutos y la ruta no.
  archivos     jsonb not null default '[]'::jsonb,

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

-- ---------------------------------------------------------------------------
-- Depósito de los adjuntos. Separado del de evidencias: aquel se ordena por
-- colaborador, este por quien reporta, porque quien manda una observación
-- puede no tener expediente.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('pdc-ayuda', 'pdc-ayuda', false, 10485760)
on conflict (id) do update
  set public = false, file_size_limit = 10485760;

do $pol$
begin
  if exists (select 1 from pg_policies
              where schemaname='storage' and tablename='objects' and policyname='pdc_ayuda_lee') then
    alter policy pdc_ayuda_lee on storage.objects
      using (bucket_id = 'pdc-ayuda'
             and ((storage.foldername(name))[1] = (select auth.uid())::text
                  or private.pdc_es_admin()));
  else
    create policy pdc_ayuda_lee on storage.objects
      for select to authenticated
      using (bucket_id = 'pdc-ayuda'
             and ((storage.foldername(name))[1] = (select auth.uid())::text
                  or private.pdc_es_admin()));
  end if;

  if exists (select 1 from pg_policies
              where schemaname='storage' and tablename='objects' and policyname='pdc_ayuda_sube') then
    alter policy pdc_ayuda_sube on storage.objects
      with check (bucket_id = 'pdc-ayuda'
                  and (storage.foldername(name))[1] = (select auth.uid())::text
                  and private.pdc_rol() is not null);
  else
    create policy pdc_ayuda_sube on storage.objects
      for insert to authenticated
      with check (bucket_id = 'pdc-ayuda'
                  and (storage.foldername(name))[1] = (select auth.uid())::text
                  and private.pdc_rol() is not null);
  end if;

  if exists (select 1 from pg_policies
              where schemaname='storage' and tablename='objects' and policyname='pdc_ayuda_borra') then
    alter policy pdc_ayuda_borra on storage.objects
      using (bucket_id = 'pdc-ayuda'
             and ((storage.foldername(name))[1] = (select auth.uid())::text
                  or private.pdc_es_admin()));
  else
    create policy pdc_ayuda_borra on storage.objects
      for delete to authenticated
      using (bucket_id = 'pdc-ayuda'
             and ((storage.foldername(name))[1] = (select auth.uid())::text
                  or private.pdc_es_admin()));
  end if;
end
$pol$;
