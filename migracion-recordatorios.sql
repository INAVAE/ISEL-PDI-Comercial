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
