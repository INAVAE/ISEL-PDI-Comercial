-- ===========================================================================
-- ISEL · Plan de Desarrollo Comercial
-- Un reloj puntual para los recordatorios
--
-- POR QUÉ EXISTE ESTO
--
-- El envío corre en GitHub Actions, con un cron cada hora que consulta la
-- configuración y decide. El problema es que ese cron no es cada hora: entre
-- el 14 y el 17 de noviembre de 2026 corrió 3, 4, 3 y 2 veces al día en vez
-- de 24. GitHub documenta las tareas programadas como «el mejor esfuerzo» y
-- las descarta cuando hay carga.
--
-- El lunes 16 eso costó el envío completo: las únicas corridas de ese día
-- cayeron a las 05:40 y a las 16:00 locales, con el envío configurado a las
-- 08:00. Nadie recibió nada.
--
-- pg_cron sí es puntual: es un trabajo de Postgres, no una cola compartida
-- con medio mundo. Así que el disparo lo da Supabase y GitHub solo manda los
-- correos. Su cron por hora se queda como red de seguridad, por si esta
-- llamada falla.
--
-- Ejecutar completo en el SQL Editor. Se puede correr dos veces sin que falle.
-- ===========================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- PEDIRLE A GITHUB QUE MANDE LOS CORREOS
-- ---------------------------------------------------------------------------
-- El token vive en el Vault y se descifra solo aquí dentro. La función está
-- en el esquema private, que no se publica en la API: nadie puede llamarla
-- desde el navegador ni leer el token a través de ella.
--
-- Se llama con forzar=false, así que la corrida pasa por la agenda igual que
-- una programada. Esta función dice CUÁNDO preguntar; quién recibe y si hoy
-- toca lo sigue decidiendo el mismo código de siempre. Duplicar aquí esa
-- decisión sería tener dos relojes que algún día dirían cosas distintas.
create or replace function private.pdc_pedir_envio()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'github_token_recordatorios';

  if v_token is null or v_token = '' then
    raise warning 'pdc: falta el secreto github_token_recordatorios en el Vault; no se pidió el envío';
    return;
  end if;

  perform net.http_post(
    url := 'https://api.github.com/repos/INAVAE/ISEL-PDI-Comercial/actions/workflows/recordatorios.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Accept',        'application/vnd.github+json',
      'Content-Type',  'application/json',
      'User-Agent',    'isel-pdi-comercial'
    ),
    body := jsonb_build_object(
      'ref', 'main',
      'inputs', jsonb_build_object(
        'solo_prueba', 'false',
        'solo_a',      '',
        'forzar',      'false'
      )
    )
  );
end
$$;

revoke all on function private.pdc_pedir_envio() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- PROGRAMAR LA CITA A PARTIR DE LA CONFIGURACIÓN
-- ---------------------------------------------------------------------------
-- pg_cron solo entiende UTC, y la configuración está en hora local. La
-- conversión puede cambiar el día de la semana —las 20:00 del lunes en
-- México son las 02:00 del martes en UTC—, así que los días se recorren
-- junto con la hora. Sin eso, un envío vespertino saldría el día anterior.
create or replace function private.pdc_reprogramar_envio()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  /* Dos minutos después de la hora elegida. Si la llamada cayera un segundo
     ANTES, la agenda respondería «todavía no son las 08:00» y, como esta es
     la única cita de la semana, el correo se iría hasta el próximo día
     elegido. El margen cuesta dos minutos y evita perder un envío entero. */
  c_gracia constant interval := interval '2 minutes';
  aj       public.pdc_recordatorios%rowtype;
  v_utc    timestamptz;
  v_desp   int;
  v_dias   text;
  v_cron   text;
begin
  select * into aj from public.pdc_recordatorios where id = 1;

  begin
    perform cron.unschedule('pdc-recordatorios');
  exception when others then
    null;   -- no estaba programado; es el caso normal la primera vez
  end;

  if aj.id is null or not aj.activo or coalesce(array_length(aj.dias, 1), 0) = 0 then
    return 'sin programar: los recordatorios están apagados o no hay días';
  end if;

  v_utc := ((current_date + make_time(aj.hora, aj.minuto, 0)) at time zone aj.zona) + c_gracia;

  /* Cuántos días corre la fecha al pasar a UTC: 0 casi siempre, 1 cuando la
     hora local es de noche. */
  v_desp := (v_utc at time zone 'UTC')::date - current_date;

  select string_agg(distinct (((d + v_desp) % 7 + 7) % 7)::text, ',')
    into v_dias
  from unnest(aj.dias) as d;

  v_cron := format('%s %s * * %s',
    extract(minute from v_utc at time zone 'UTC')::int,
    extract(hour   from v_utc at time zone 'UTC')::int,
    v_dias);

  perform cron.schedule('pdc-recordatorios', v_cron, 'select private.pdc_pedir_envio()');

  return format('programado: %s UTC (%s:%s %s + %s de gracia)',
    v_cron, lpad(aj.hora::text, 2, '0'), lpad(aj.minuto::text, 2, '0'), aj.zona, c_gracia);
end
$$;

revoke all on function private.pdc_reprogramar_envio() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- QUE SE REPROGRAME SOLO
-- ---------------------------------------------------------------------------
-- Cuando el administrador cambia el día o la hora en la pantalla, la cita se
-- mueve sin que nadie toque SQL.
--
-- El error se traga a propósito: si pg_cron fallara, lo que NO puede pasar es
-- que el administrador no pueda guardar su configuración. Queda el aviso en
-- el registro, y el cron por hora de GitHub sigue de red de seguridad.
create or replace function private.pdc_al_cambiar_recordatorios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.pdc_reprogramar_envio();
  exception when others then
    raise warning 'pdc: no se pudo reprogramar el envío (%). La configuración sí se guardó.', sqlerrm;
  end;
  return null;
end
$$;

drop trigger if exists pdc_recordatorios_reprogramar on public.pdc_recordatorios;

create trigger pdc_recordatorios_reprogramar
after insert or update of activo, dias, hora, minuto, zona
on public.pdc_recordatorios
for each row
execute function private.pdc_al_cambiar_recordatorios();

-- ---------------------------------------------------------------------------
-- PARA REVISAR QUE SIGUE VIVO
-- ---------------------------------------------------------------------------
-- Si un día los correos vuelven a no llegar, esto dice en un renglón si la
-- cita está puesta y cómo le fue a la última llamada a GitHub. Un 401 aquí
-- significa que el token caducó o se revocó.
create or replace function private.pdc_estado_reloj()
returns table (cita text, activa boolean, ultima_llamada timestamptz, respuesta text)
language sql
security definer
set search_path = ''
as $$
  select j.schedule,
         j.active,
         r.created,
         case
           when r.status_code is null then 'sin llamadas todavía'
           when r.status_code = 204   then '204 · GitHub aceptó la petición'
           when r.status_code = 401   then '401 · el token caducó o se revocó'
           when r.status_code = 403   then '403 · al token le falta el permiso de Actions'
           when r.status_code = 404   then '404 · no encontró el repositorio o el flujo'
           else r.status_code || ' · ' || coalesce(left(r.content, 200), '')
         end
  from cron.job j
  left join lateral (
    select * from net._http_response order by created desc limit 1
  ) r on true
  where j.jobname = 'pdc-recordatorios';
$$;

revoke all on function private.pdc_estado_reloj() from public, anon, authenticated;

-- Deja la cita puesta con la configuración que haya ahora mismo
select private.pdc_reprogramar_envio() as resultado;
