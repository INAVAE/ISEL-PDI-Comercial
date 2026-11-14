# Recordatorios por correo

Lunes y jueves, cada colaborador activo recibe el resumen de su semana: lo
atrasado, lo que toca ahora y lo que lleva hecho. Corre desde GitHub Actions
(`.github/workflows/recordatorios.yml`) y sale desde la cuenta de Gmail de
ISEL.

## Por qué no corre en Supabase

Supabase bloquea los puertos de SMTP (25, 465 y 587) en las Edge Functions,
así que desde ahí no se puede hablar con `smtp.gmail.com`. GitHub Actions sí
los permite, y de paso deja el historial de cada envío a la vista.

## Las tres piezas

| Archivo | Qué hace |
| --- | --- |
| `resumen.mjs` | Decide qué dice el correo. No depende de nada externo, por eso se puede probar. |
| `enviar.mjs` | Trae los datos de Supabase y los manda. |
| `prueba.mjs` | Comprueba el resumen contra expedientes reales exportados. |

Las lecturas van por `fetch` contra la API REST, sin `supabase-js`: son tres
consultas sin sesión ni tiempo real, y esa librería arrastra un cliente de
realtime que exige WebSocket nativo —en Node 20 tumbaba la corrida antes de
leer un solo renglón—. `nodemailer` se carga solo cuando de verdad se va a
mandar algo, así que el modo prueba corre sin ninguna dependencia.

El resumen reutiliza `js/metricas.js`, el mismo cálculo que usa la pantalla.
Con una copia, a la primera corrección el correo y el panel dirían cosas
distintas, y de las dos la persona creería la que le conviene.

## Lo que hay que configurar una sola vez

En **Settings → Secrets and variables → Actions** del repositorio:

**Secrets**

| Nombre | De dónde sale |
| --- | --- |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | la misma pantalla, `service_role`. Lee todos los expedientes saltándose las políticas: solo debe vivir aquí. |
| `GMAIL_USER` | la cuenta desde la que sale el correo |
| `GMAIL_APP_PASSWORD` | contraseña **de aplicación** de Google, no la normal |

**Variables**

| Nombre | Valor |
| --- | --- |
| `APP_URL` | la dirección de la página, para el botón del correo |

### La contraseña de aplicación

La contraseña normal de Gmail no sirve: Google la rechaza desde programas.
Hay que generar una de aplicación, y para eso la cuenta necesita la
verificación en dos pasos activada.

1. myaccount.google.com → Seguridad → Verificación en dos pasos, activarla.
2. En la misma pantalla, "Contraseñas de aplicaciones".
3. Crear una con el nombre que se quiera; Google da 16 letras.
4. Copiarlas como el secreto `GMAIL_APP_PASSWORD`, sin espacios.

## Probar sin mandarle nada a nadie

En la pestaña **Actions** del repositorio, "Recordatorios del plan de
desarrollo" → **Run workflow**. Deja marcado *solo prueba* y lista a quién le
tocaría, con qué asunto y cuántas tareas, sin mandar un solo correo.

Para ver el correo de verdad sin molestar al equipo, desmarca *solo prueba* y
escribe tu dirección en *solo_a*: todos los correos llegan ahí.

## Correr las pruebas del resumen

Necesitan un `datos.json` con expedientes reales, que no se versiona porque
lleva nombres y correos. Para generarlo, en el SQL Editor de Supabase:

```sql
select jsonb_build_object(
  'cols',     (select jsonb_agg(to_jsonb(c)) from public.pdc_colaboradores c where c.estado='activo'),
  'avance',   (select coalesce(jsonb_agg(jsonb_build_object(
                 'colaborador_id', a.colaborador_id, 'tarea_id', a.tarea_id, 'hecho', a.hecho)), '[]'::jsonb)
               from public.pdc_plan_avance a),
  'perfiles', (select jsonb_agg(jsonb_build_object('id', p.id, 'email', p.email)) from public.pdc_profiles p)
)::text;
```

Guardar el resultado como `datos.json` en esta carpeta y correr:

```sh
node herramientas/recordatorios/prueba.mjs
```

Deja los correos renderizados como `correo-<nombre>.html` para abrirlos en el
navegador.

## Quién recibe

Los colaboradores con estado **activo** y con correo: el de su cuenta de
acceso si la tienen vinculada, y si no el de su ficha. A quien no tenga
ninguno se le salta y queda anotado en el registro de la corrida.

Un correo que rebota no detiene a los demás, pero la corrida sale en rojo
para que no pase inadvertido.
