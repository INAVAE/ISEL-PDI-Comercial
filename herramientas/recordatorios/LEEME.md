# Recordatorios por correo

A cada persona en desarrollo le llega el resumen de su semana —lo atrasado,
lo que toca ahora y lo que lleva hecho—; y a quien da seguimiento, el
panorama de las personas que le corresponden. El reloj lo pone Supabase, el
envío lo ejecuta GitHub Actions (`.github/workflows/recordatorios.yml`) y
sale desde la cuenta de Gmail de ISEL.

**Los días, la hora y los destinatarios no se tocan aquí.** Se configuran en
la aplicación, en *Administración → Recordatorios*, que solo ve el
administrador. Este archivo es para quien tenga que entender o reparar la
maquinaria.

## Quién dispara el envío

Dos relojes, y el orden importa:

1. **El pg_cron de Supabase** es el disparador de verdad. A la hora elegida
   le pide a GitHub que corra el flujo, con `forzar=false` para que la
   corrida pase por la agenda igual que una programada.
2. **El cron por hora de GitHub** se queda como red de seguridad. Si la
   llamada de Supabase falla —token caducado, Supabase caído—, una corrida
   de GitHub dentro de la jornada todavía alcanza a mandar.

No siempre fue así, y el motivo está abajo.

### Por qué no basta el cron de GitHub

Medido entre el 14 y el 17 de noviembre de 2026, con `cron: "17 * * * *"`:
3, 4, 3 y 2 corridas por día, en vez de 24. GitHub documenta las tareas
programadas como «el mejor esfuerzo» y las posterga o descarta cuando hay
carga; en un repositorio público con poco movimiento descarta casi todas.

Eso costó el envío del lunes 16 completo: las únicas corridas de ese día
cayeron a las 05:40 y a las 16:00 locales, con el envío configurado a las
08:00. Nadie recibió nada.

pg_cron sí es puntual, porque es un trabajo de Postgres y no una cola
compartida con medio mundo.

Ojo también: GitHub desactiva los flujos programados de un repositorio sin
actividad durante 60 días. Eso solo afectaría a la red de seguridad.

### Las piezas en Supabase

Todas en el esquema `private`, que no se publica en la API. Están en
`migracion-reloj.sql`.

| Función | Qué hace |
| --- | --- |
| `pdc_pedir_envio()` | Llama a GitHub con el token del Vault. |
| `pdc_reprogramar_envio()` | Calcula la cita en UTC desde la configuración y la agenda en pg_cron. |
| `pdc_al_cambiar_recordatorios()` | Disparador: reprograma sola la cita cuando cambian los días o la hora. |
| `pdc_estado_reloj()` | Diagnóstico: si la cita está puesta y cómo le fue a la última llamada. |

Dos cosas que cuestan de ver y que no hay que deshacer:

- **La cita va dos minutos después de la hora elegida.** Si la llamada
  cayera un segundo antes, la agenda contestaría «todavía no es la hora» y,
  siendo la única cita de la semana, el correo se iría hasta el próximo día
  elegido.
- **La conversión a UTC recorre el día de la semana.** Las 20:00 del lunes
  en México son las 02:00 del martes en UTC. Sin ese ajuste, un envío
  vespertino saldría el día anterior.

El error al reprogramar se traga a propósito: lo que no puede pasar es que
un fallo de pg_cron impida al administrador guardar su configuración.

### El token de GitHub

Vive en el Vault de Supabase con el nombre `github_token_recordatorios`, y
se descifra solo dentro de `pdc_pedir_envio()`. Es un token de alcance
fino: solo este repositorio, solo el permiso **Actions: read and write**.

El que está puesto se generó **sin fecha de caducidad**, a propósito: con
fecha, el día que venciera los correos dejarían de salir a su hora y nada
lo avisaría.

Si algún día se revoca o se cambia, los correos no desaparecen: vuelven a
depender de la red de seguridad y llegan en algún momento de la jornada en
vez de a la hora en punto. Para reemplazarlo basta generar otro igual y
cambiar el secreto en el Vault; no hay que tocar código.

Para ver cómo va:

```sql
select * from private.pdc_estado_reloj();
```

Un `401` ahí significa que caducó o lo revocaron; un `403`, que le falta el
permiso de Actions.

## Cómo decide si hoy toca

La decisión vive en `js/agenda.js`, en `js/` y no aquí porque la usan los
dos: el envío para decidir y la pantalla para anunciar cuándo saldrá el
próximo correo. Con una copia de cada lado, la pantalla acabaría prometiendo
una cosa y el envío haciendo otra.

El flujo pregunta primero y solo instala nodemailer si la respuesta es que
sí. Una corrida que no manda nada tarda unos segundos.

Dos detalles que no son obvios:

- **Recuperación.** El correo sale en la primera corrida que alcance después
  de la hora elegida, hasta el fin de la jornada —las 18:00 locales, o seis
  horas después de la hora elegida si esta es vespertina—. Más tarde que eso
  se deja para el próximo día elegido: un recordatorio de las 7 de la mañana
  que llega a las once de la noche ya no es un recordatorio.
- **No se repite.** Al terminar, el envío anota la fecha local en
  `pdc_recordatorios.ultimo_envio`. Sin esa marca, la corrida siguiente
  volvería a mandar todo. Se anota aunque algún correo haya rebotado: entre
  repetir un correo y perder un día, lo segundo se nota menos y además deja
  la corrida en rojo.

## Quién recibe, y los dos defaults

La tabla `pdc_recordatorio_destinos` lleva un renglón por persona, que apunta
a un colaborador o a un perfil, nunca a los dos. Los valores que faltan tienen
defaults **distintos**, y es lo único de todo esto que se presta a entenderse
al revés:

| Si no hay renglón… | …entonces |
| --- | --- |
| de un **colaborador** | recibe el resumen de su plan |
| de un **perfil** | no recibe el panorama |

La razón: al dar de alta a alguien nuevo nadie tiene que acordarse de
encenderle el correo, y a la vez no se le manda a toda la plantilla un
panorama que nadie pidió.

### Hasta dónde ve quien recibe el panorama

La columna `alcance` del mismo renglón:

| `alcance` | Ve a | Para quién |
| --- | --- | --- |
| `todo` | todas las personas en desarrollo | la dirección, un rol de solo lectura |
| `propios` | solo los colaboradores con su `mentor_id` | un mentor |

`propios` se resuelve contra el `mentor_id` de cada ficha, que es la misma
asignación que muestra la aplicación: no hay una segunda lista de carteras
que pudiera quedar desfasada.

El default de la columna es `todo`, porque es lo que ya recibían los
marcados antes de que existiera. Pero la pantalla, al encender a alguien
que tiene gente a su cargo, guarda `propios`: enseñarle a un mentor de
entrada el avance de gente que no le toca no es un default razonable.

Un `propios` sin nadie asignado no genera correo. Una tabla vacía no le dice
nada a nadie y hace parecer que el programa está roto.

### Quien es mentor y colaborador a la vez

Recibe **un solo correo**: su plan arriba y su cartera abajo. Por eso
`enviar.mjs` calcula todos los resúmenes antes de mandar nada —hay que saber
quién es además observador para armarle el correo— y por eso el panorama
está partido en `bloqueEquipo()`, que se usa suelto y empotrado.

Su cartera entra al asunto solo si hay alguien con atraso. Si todos van al
día, el dato está adentro y no tiene por qué quitarle espacio a lo suyo en
la lista del correo.

## Por qué el envío no corre también en Supabase

El reloj sí está en Supabase, pero el envío no, y no por gusto: Supabase
bloquea los puertos de SMTP (25, 465 y 587) en las Edge Functions, así que
desde ahí no se puede hablar con `smtp.gmail.com`. GitHub Actions sí los
permite, y de paso deja el historial de cada envío a la vista.

Mover el envío a Supabase obligaría a dejar Gmail por un servicio de correo
por HTTP —Resend, Brevo— y a verificar el dominio con registros DNS.

## Las piezas

| Archivo | Qué hace |
| --- | --- |
| `../../js/agenda.js` | Decide si hoy toca enviar, y a partir de cuándo será el próximo. |
| `resumen.mjs` | Decide qué dice cada uno de los dos correos. |
| `enviar.mjs` | Trae los datos de Supabase y los manda. Lo único con entradas y salidas. |
| `prueba-agenda.mjs` | Fechas inventadas: medianoche, domingo, cambio de horario, retrasos. |
| `prueba-envio.mjs` | Levanta un Supabase de mentiras y corre `enviar.mjs` de verdad contra él. |
| `prueba.mjs` | Comprueba el resumen contra expedientes reales exportados. |

Las dos primeras pruebas no necesitan nada —ni red, ni datos, ni
dependencias— y se corren así:

```sh
node herramientas/recordatorios/prueba-agenda.mjs
node herramientas/recordatorios/prueba-envio.mjs
```

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

Una corrida a mano **omite la agenda**: manda sin importar el día ni la hora
configurados, y no consume el envío del día.

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

## A qué dirección llega

De un colaborador: la de su cuenta de acceso si la tiene vinculada, y si no
la de su ficha. A quien no tenga ninguna se le salta, y queda anotado en el
registro de la corrida. De un observador: la de su cuenta, y solo mientras
su acceso siga vigente.

Un correo que rebota no detiene a los demás, pero la corrida sale en rojo
para que no pase inadvertido.

## Si algo no llega

El registro de cada corrida empieza con una línea `Agenda: …` que dice por
qué sí o por qué no. Casi siempre la respuesta está ahí: que hoy no es día
elegido, que todavía no es la hora, que ya se envió, o que está apagado.
