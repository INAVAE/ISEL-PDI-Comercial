# Recordatorios por correo

A cada persona en desarrollo le llega el resumen de su semana —lo atrasado,
lo que toca ahora y lo que lleva hecho—; y a quien da seguimiento, el
panorama de las personas que le corresponden. Corre desde GitHub Actions
(`.github/workflows/recordatorios.yml`) y sale desde la cuenta de Gmail de
ISEL.

**Los días, la hora y los destinatarios no se tocan aquí.** Se configuran en
la aplicación, en *Administración → Recordatorios*, que solo ve el
administrador. Este archivo es para quien tenga que entender o reparar la
maquinaria.

## Cómo sabe cuándo enviar

El cron de un repositorio no se puede cambiar desde una pantalla, así que el
flujo corre **cada hora** y casi siempre no hace nada: lee la configuración,
decide y se va. Una corrida que no manda nada tarda unos segundos y ni
siquiera instala nodemailer.

La decisión vive en `js/agenda.js`, en `js/` y no aquí porque la usan los
dos: el envío para decidir y la pantalla para anunciar cuándo saldrá el
próximo correo. Con una copia de cada lado, la pantalla acabaría prometiendo
una cosa y el envío haciendo otra.

Dos detalles que no son obvios:

- **Recuperación.** GitHub no garantiza la hora. Si la corrida de la hora
  elegida se retrasa, el correo sale en la primera que alcance, dentro de las
  seis horas siguientes; pasado ese margen se deja para el próximo día
  elegido, porque un recordatorio de las 7 de la mañana que llega a las once
  de la noche ya no es un recordatorio.
- **No se repite.** Al terminar, el envío anota la fecha local en
  `pdc_recordatorios.ultimo_envio`. Sin esa marca, la corrida de la hora
  siguiente volvería a mandar todo. Se anota aunque algún correo haya
  rebotado: entre repetir un correo y perder un día, lo segundo se nota
  menos y además deja la corrida en rojo.

Ojo: GitHub desactiva los flujos programados de un repositorio sin actividad
durante 60 días. Si los correos dejan de llegar sin explicación, eso es lo
primero que hay que revisar en la pestaña Actions.

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

## Por qué no corre en Supabase

Supabase bloquea los puertos de SMTP (25, 465 y 587) en las Edge Functions,
así que desde ahí no se puede hablar con `smtp.gmail.com`. GitHub Actions sí
los permite, y de paso deja el historial de cada envío a la vista.

## Las tres piezas

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
