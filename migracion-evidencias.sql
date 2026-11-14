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
