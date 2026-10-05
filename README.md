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

## 2. Los tres roles

| | Administrador | Mentor | Colaborador en desarrollo |
|---|---|---|---|
| Ver el avance de todos | Sí | Sí | No, solo el propio |
| Registrar y archivar colaboradores | Sí | Sí | No |
| Borrar un colaborador | Sí | No | No |
| Editar el plan, objetivos y metas | De cualquiera | De sus asignados | No |
| Calificar competencias | Sí | De sus asignados | No, solo consulta |
| Validar resultados y visitas | Sí | De sus asignados | No |
| Registrar visitas, oportunidades y cuentas | Sí | Sí | Sí, las suyas |
| Marcar tareas del plan | Sí | Sí | Sí, las suyas |
| Sesiones de coaching y dictamen | Sí | De sus asignados | Solo lectura |
| Asignar roles y usuarios | Sí | No | No |
| Plantilla base del programa | Sí | No | No |

Estas reglas no viven solo en la interfaz: están escritas como políticas de acceso en la base
de datos. Aunque alguien manipulara el navegador, el servidor rechaza la operación.

### Dar de alta a una persona

1. **Supabase → Authentication → Users → Add user**: correo y contraseña.
2. En la aplicación, **Usuarios y roles**: aparece con el rol de colaborador; cámbialo si es
   mentor o administrador.
3. Si es alguien a desarrollar, ve a **Colaboradores → Registrar colaborador**, llena su ficha
   y, en *Cuenta de acceso del colaborador*, vincúlala con el usuario que creaste. Ese vínculo
   es lo que le permite entrar y ver únicamente su propio expediente.

---

## 3. Qué hay en cada sección

**Resumen general** (administrador y mentor). Comparativo de todos los participantes:
scorecard, avance del plan, visitas, pipeline, ventas y cuentas, con gráficas para ver quién
va adelante y quién necesita atención esta semana.

**Colaboradores**. Registro con nombre, edad, puesto actual, puesto deseado, correo, teléfono,
sucursal, fecha de inicio y mentor asignado. Se pueden archivar, reactivar, marcar como
graduados o borrar. Al registrar a alguien se le genera automáticamente su copia del programa
completo.

**Panel**. El tablero individual: puntos de graduación, semana en curso, indicadores clave,
radar de competencias, visitas contra plan, embudo, evolución del scorecard y alertas.

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

**¿Funciona en celular?**
Sí. El menú se convierte en una barra horizontal y las tablas se desplazan. Para capturar
visitas desde la planta funciona bien; para configurar el programa conviene una pantalla grande.

**Un usuario entra pero no ve nada.**
Si es colaborador, revisa que su ficha en **Colaboradores** tenga vinculada su *Cuenta de
acceso*. Sin ese vínculo la base de datos no le muestra ningún expediente, que es justo lo que
debe pasar.
