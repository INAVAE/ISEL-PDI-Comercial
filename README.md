# ISEL · Plan de Desarrollo Comercial

Aplicación web para desarrollar y evaluar, en paralelo, a varios vendedores internos que
transitan hacia el puesto de vendedor externo o consultor comercial.

Toda la información vive en Supabase. El código es HTML, CSS y JavaScript sin compilación,
así que se publica tal cual en GitHub Pages o en cualquier servidor estático.

---

## 1. Estado actual

| | |
|---|---|
| Proyecto de Supabase | **ISEL - PDI** (`dezzafcyjbcxcgrqezkp`, región us-east-2) |
| Base de datos | **Lista.** 10 tablas, 24 políticas de acceso, auditoría de seguridad sin hallazgos |
| Conexión de la aplicación | **Configurada** en `js/config.js` |
| Falta | Crear el primer usuario y publicar el sitio |

El archivo `schema.sql` documenta exactamente lo que está aplicado. No necesitas correrlo;
sirve como referencia y para poder levantar el sistema en otro proyecto si hiciera falta.

### Paso 1 · Crear tu usuario administrador

1. En Supabase, **Authentication → Users → Add user**: tu correo y una contraseña.
   Marca *Auto Confirm User* para no tener que confirmar por correo.
2. En el **SQL Editor**, ejecuta con tu correo:

```sql
update public.pdc_profiles set rol = 'admin' where email = 'tu@correo.com';
```

A partir de ahí puedes crear a los demás y asignarles su rol desde la propia aplicación.

### Paso 2 · Publicar

**GitHub Pages**

1. Sube todos los archivos al repositorio `ISEL-PDI-Comercial`.
2. Ve a **Settings → Pages**, elige la rama `main` y la carpeta `/ (root)`.
3. En un par de minutos queda en `https://inavae.github.io/ISEL-PDI-Comercial/`.

**Cualquier otro servidor**

Copia la carpeta completa al directorio público. No hay paso de compilación ni dependencias
que instalar.

### Paso 3 · Autorizar el dominio

En Supabase, **Authentication → URL Configuration**, agrega la dirección donde publicaste la
aplicación en *Site URL* y en *Redirect URLs*. Sin esto, la recuperación de contraseña no
regresa al sitio correcto.

---

## 2. Los cuatro roles

| | Administrador | Mentor | Colaborador | Solo lectura |
|---|---|---|---|---|
| Ver el avance de todos | Sí | Sí | No, solo el propio | Sí |
| Usar los filtros | Sí | Sí | Sí | Sí |
| Registrar y archivar colaboradores | Sí | Sí | No | No |
| Borrar un colaborador | Sí | No | No | No |
| Editar el plan, objetivos y metas | De cualquiera | De sus asignados | No | No |
| Calificar competencias | Sí | De sus asignados | No, solo consulta | No |
| Validar resultados y visitas | Sí | De sus asignados | No | No |
| Registrar visitas, oportunidades y cuentas | Sí | Sí | Sí, las suyas | No |
| Marcar tareas del plan | Sí | Sí | Sí, las suyas | No |
| Sesiones de coaching y dictamen | Sí | De sus asignados | Solo lectura | Solo lectura |
| Crear usuarios y asignar roles | Sí | No | No | No |
| Plantilla base del programa | Sí | No | No | No |

Estas reglas no viven solo en la interfaz: están escritas como políticas de acceso en la base
de datos. Aunque alguien manipulara el navegador, el servidor rechaza la operación.

### Dar de alta a una persona

Todo se hace desde **Usuarios y roles → Agregar usuario**. Escribes el correo, el nombre y el
rol; la aplicación propone una contraseña temporal legible, de dos palabras y un número, para
que la puedas dictar por teléfono. Al entrar por primera vez se le pide cambiarla.

Si el correo ya tiene cuenta en ISEL por otra herramienta, como la Junta Mensual, se reutiliza
esa misma cuenta: la persona conserva su contraseña y simplemente gana acceso a esta
herramienta. Una cuenta por persona, un acceso por herramienta.

Para un colaborador en desarrollo falta un paso más: ve a **Colaboradores → Registrar
colaborador**, llena su ficha y, en *Cuenta de acceso del colaborador*, vincúlala con el
usuario que creaste. Ese vínculo es lo que le permite ver su propio expediente.

Las cuentas nunca se borran desde aquí. *Quitar acceso* solo retira el acceso a este plan de
desarrollo; la cuenta sigue existiendo para las demás herramientas de ISEL. Para suspender a
alguien temporalmente, basta con desactivarlo.

### Por qué la gestión de usuarios pasa por el servidor

Crear cuentas y cambiar contraseñas exige la llave secreta del proyecto, y esa llave jamás
puede viajar al navegador: quien abriera el código fuente de la página la vería. Por eso esa
parte corre en una función alojada en Supabase (`supabase/functions/pdc-usuarios`), que
guarda la llave y verifica por su cuenta que quien pide sea un administrador activo.

La función protege dos cosas por diseño: nadie puede quitarse a sí mismo el acceso o el rol de
administrador, y el sistema nunca se queda sin ningún administrador activo.

---

## 3. Qué hay en cada sección

**Resumen general** (todos menos el colaborador). Comparativo de los participantes: scorecard,
avance del plan, visitas, pipeline, ventas y cuentas, con gráficas para ver quién va adelante y
quién necesita atención. Se filtra por sucursal, mentor y estado, y se ordena dando clic en
cualquier encabezado.

**Colaboradores**. Registro con nombre, edad, puesto actual, puesto deseado, correo, teléfono,
sucursal, fecha de inicio y mentor asignado. Se pueden archivar, reactivar, marcar como
graduados o borrar. Al registrar a alguien se le genera automáticamente su copia del programa
completo.

**Panel**. El tablero individual: puntos de graduación, semana en curso, ritmo del programa,
indicadores clave, radar de competencias, visitas contra plan, embudo, evolución del scorecard
y alertas.

### Ritmo del programa

Responde si el plan se está cumpliendo en tiempo, no solo si se está cumpliendo bien. Alguien
puede tener un scorecard de 4.2 y llevar tres semanas de retraso: eso es un problema de
programa aunque el desempeño sea bueno.

A partir de la fecha de inicio, la aplicación calcula en qué semana debería ir la persona hoy
y la compara con la semana que lleva marcada. La línea de tiempo muestra ambas marcas y el
tramo de desfase entre ellas, en verde si va adelante y en rojo si va atrás.

Se muestran dos lecturas porque miden cosas distintas:

- **La semana declarada** es un marcador que el mentor mueve a mano. Si se le olvida
  actualizarlo, la persona aparece atrasada sin estarlo.
- **El avance de tareas** sale de la evidencia: cuántas tareas deberían estar completas a la
  fecha y cuántas lo están. Esta es la lectura honesta.

Cuando las dos discrepan, la aplicación lo dice: si la semana va atrasada pero las tareas están
al día, lo que falta es mover el marcador; si la semana va al corriente pero faltan tareas, el
avance real está por debajo de lo que aparenta.

El **término previsto** se calcula sumando una semana por cada semana del plan. Se puede
definir a mano al registrar al colaborador o editando su ficha, que es lo que se hace cuando el
programa se pausa por vacaciones o incapacidad: al recorrer el cierre, la persona deja de
aparecer atrasada por algo que no estuvo en sus manos.

El resumen general trae una columna de **Ritmo** con el veredicto de cada participante, que se
puede ordenar para ver primero a quien más se ha rezagado.

**Ruta de 20 semanas**. El programa mes por mes y semana por semana, con lista de verificación.
El colaborador marca lo que completa y adjunta la evidencia; el mentor lo revisa.

**Competencias**. Las 42 competencias en 11 grupos ponderados, con nivel inicial esperado,
nivel requerido, importancia y método de evaluación. Se califica de 1 a 5 en seis cortes.

**KPIs**. Metas mensuales por indicador contra resultado real, con semáforo y validación del
mentor. Todas las metas son editables. Una vez que el mentor marca un resultado como validado,
el colaborador ya no puede modificarlo: queda como cifra oficial del mes.

**Visitas de campo**. El formato completo de revisión de visita y la progresión obligatoria de
observar al mentor hasta liderar solo.

**Pipeline**. Oportunidades con criterios objetivos de avance por etapa. Separa lo que el
vendedor creó de lo que fue solicitud del cliente.

**Cuentas**. Account Plan con mapa de stakeholders y escalera de madurez de la cuenta.

**Coaching**. Cadencia de acompañamiento y registro de cada sesión con sus acuerdos.

**Graduación**. Criterios ponderados, examen final, dictamen automático y plan de 90 días.

**Riesgos**. Los modos de falla del programa, su señal de alerta y la acción preventiva.

**Configurar programa** (administrador y mentor). Aquí se edita todo: semanas, tareas,
competencias y sus pesos, indicadores y metas, criterios de graduación y sus umbrales, plan de
campo, etapas del embudo, componentes del examen y riesgos.

**Plantilla base** (administrador). La versión que se copia a cada colaborador nuevo.

**Usuarios y roles** (administrador). Alta de usuarios, cambio de rol, suspensión, restablecer
contraseña y retiro de acceso, con el último ingreso de cada quien.

### Filtros

Casi todas las listas se filtran, y los filtros están disponibles para todos los roles. El
resumen general filtra por sucursal, mentor y estado y ordena por cualquier columna. Los
colaboradores se buscan por nombre, correo o puesto. Las visitas se filtran por mes, tipo de
participación, cuentas nuevas y pendientes de validar. El pipeline, por etapa, origen y las que
no tienen próxima acción. Las cuentas, por madurez, sector y planes sin aprobar. Las
competencias, por grupo, y con interruptores para ver solo las críticas, solo las que están por
debajo del nivel requerido o solo las que faltan por evaluar.

---

## 4. Todo es configurable

Nada está fijo en el código. Desde **Configurar programa**, el mentor puede:

- Agregar, reescribir o eliminar semanas completas y cada una de sus tareas.
- Cambiar el objetivo, el tema, la capacitación, la práctica y la evidencia de cada semana.
- Agregar competencias propias de la sucursal o el mercado, cambiar su nivel requerido y su
  importancia, y reajustar los pesos de cada grupo.
- Definir las metas mensuales de cada indicador y crear indicadores nuevos.
- Cambiar los criterios de graduación, su meta, sus puntos y los umbrales de cada dictamen.
- Ajustar el plan de campo mes por mes.
- Modificar las etapas del embudo y sus criterios de avance.

Cada colaborador tiene su propia copia, así que ajustar el plan de una persona no altera el de
las demás. Si un plan te queda bien, `Copiar programa de otro colaborador` lo replica, y desde
**Plantilla base** puedes convertirlo en el punto de partida de los siguientes registros.

### Criterios de graduación calculados

Al definir un criterio eliges de dónde sale el valor real. Las opciones son: scorecard
ponderado, competencias críticas por debajo del nivel requerido, visitas acumuladas, visitas
lideradas solo, oportunidades detectadas, pipeline abierto, pipeline calificado, ventas
cerradas, cuentas mapeadas, Account Plans aprobados, oportunidades ganadas, promedio de role
plays, evaluación del gerente, examen final, avance del plan y verificación manual del mentor.

El dictamen se recalcula solo conforme entra la evidencia.

---

## 5. Archivos

```
index.html            Punto de entrada
styles.css            Estilos
schema.sql            Estructura y políticas de la base de datos
js/config.js          Conexión con Supabase (lo único que debes editar)
js/plantilla.js       Programa base de 20 semanas, competencias, KPIs y criterios
js/db.js              Acceso a datos y sesión
js/ui.js              Componentes y gráficas en SVG
js/metricas.js        Cálculo de scorecard, dictamen y comparativos
js/app.js             Sesión, permisos y navegación
js/vistas-gestion.js  Resumen, colaboradores, usuarios, plantilla y cuenta
js/vistas-programa.js Panel, ruta, competencias, KPIs, graduación, riesgos y configuración
js/vistas-actividad.js Visitas, pipeline, cuentas y coaching
supabase/functions/pdc-usuarios/index.ts   Gestión de usuarios (corre en el servidor)
```

---

## 6. Dudas frecuentes

**¿Se puede usar el mismo proyecto de Supabase que Best Sales Candidate?**
Sí. Las tablas llevan el prefijo `pdc_` y las funciones también, así que conviven sin tocar lo
que ya existe. Los usuarios de Authentication se comparten, lo cual es una ventaja: una sola
credencial por persona para ambas herramientas. El rol de esta aplicación se guarda en
`pdc_profiles` y es independiente del que tenga en el otro proyecto.

**¿Qué pasa si cambio la plantilla base?**
Solo afecta a los colaboradores que registres después. Los que ya están en desarrollo conservan
su plan tal como estaba.

**¿Cómo respaldo la información?**
Supabase respalda automáticamente. Además, desde **Plantilla base** puedes descargar la
configuración del programa en un archivo.

**¿Puedo cambiar el tema?**
Sí. El botón está al pie del menú lateral. La primera vez toma la preferencia de tu sistema
operativo; en cuanto eliges uno, se recuerda en tu navegador. Cada persona tiene el suyo.

**¿Funciona en celular?**
Sí. El menú se convierte en una barra horizontal y las tablas se desplazan. Para capturar
visitas desde la planta funciona bien; para configurar el programa conviene una pantalla grande.

**Un usuario entra pero no ve nada.**
Si es colaborador, revisa que su ficha en **Colaboradores** tenga vinculada su *Cuenta de
acceso*. Sin ese vínculo la base de datos no le muestra ningún expediente, que es justo lo que
debe pasar.
