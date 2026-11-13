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
