/* ===========================================================================
   CONTENIDO DE LA AYUDA

   Una sola fuente para todo lo que se consulta dentro de la aplicación:
   el manual por capítulos, las preguntas frecuentes y el diagnóstico de
   fallas. Si se escribieran por separado, a la tercera corrección ya
   dirían cosas distintas.

   Está redactado hablándole a quien lee, sea quien sea. Donde algo solo
   aplica a un rol, se dice en la propia frase en vez de esconderlo.
   =========================================================================== */

export const SUG_TIPO = { error: "Error", mejora: "Mejora", duda: "Duda", otro: "Otro" };

export const SUG_PISTA = {
  error: "Algo no funciona como debería.",
  mejora: "Funciona, pero podría servir mejor.",
  duda: "No entiendes cómo se usa algo.",
  otro: "Cualquier otra cosa.",
};

export const SUG_ESTADO = {
  nueva: { k: "Sin revisar", estado: "off" },
  en_revision: { k: "En revisión", estado: "signal" },
  resuelta: { k: "Resuelta", estado: "run" },
  descartada: { k: "Descartada", estado: "off" },
};

export const AYUDA = {
  guia: [
    {
      id: "que-es",
      titulo: "Qué es esta herramienta y qué no es",
      para: "Para qué sirve el expediente y hasta dónde llega.",
      pasos: [
        ["Qué es", "El expediente vivo de un programa de 20 semanas que lleva a una persona de ventas internas a ventas externas. No es un reporte que se llena al final: es donde se va dejando la evidencia mientras ocurre."],
        ["Para quién", "Cuatro roles comparten la misma página y cada uno ve y toca lo que le corresponde: el colaborador en desarrollo, su mentor, el administrador del programa y quien solo consulta."],
        ["Qué mide", "Dos cosas distintas que conviene no confundir. El ritmo, que es si el programa va en tiempo. Y la graduación, que es si la persona ya reúne lo necesario para el puesto."],
        ["Qué NO hace", "No decide. Calcula puntos, marca riesgos y proyecta un dictamen, pero graduar o no a alguien es una decisión de personas, con el mentor y el gerente en la mesa."],
      ],
      ojo: "El dictamen nunca debería ser una sorpresa. Si lo es, significa que el expediente se llenó tarde.",
    },
    {
      id: "entrar",
      titulo: "Entrar por primera vez",
      para: "Tienes un correo y una contraseña que te dio el administrador.",
      pasos: [
        ["Abre la página", "El administrador te pasa la dirección. Funciona en computadora, tableta y celular; no se instala nada."],
        ["Escribe tu correo y la contraseña provisional", "Son las que te dieron. Si no te llegaron, pídeselas al administrador: nadie más puede verlas."],
        ["Cámbiala", "La primera vez el sistema no te deja pasar hasta que elijas una contraseña tuya, de al menos 8 caracteres. Es a propósito: la que te dieron la conoce otra persona."],
        ["Si la olvidas", "Usa «Olvidé mi contraseña» en la pantalla de acceso. Te llega un correo y, al abrir el enlace, el sistema te pide una nueva antes de dejarte entrar. El enlace caduca; si ya no sirve, pide otro."],
      ],
      ojo: "Si entras y ves «un administrador debe concederte acceso», tu cuenta existe pero todavía no tiene rol en esta herramienta. Eso lo resuelve el administrador en Usuarios y roles.",
    },
    {
      id: "roles",
      titulo: "Quién puede hacer qué",
      para: "Los cuatro roles y la frontera entre ellos.",
      pasos: [
        ["Colaborador en desarrollo", "Marca sus tareas y sube evidencia, registra visitas, oportunidades y cuentas, y captura sus resultados de KPIs. Ve su expediente completo, incluido su dictamen proyectado."],
        ["Mentor", "Todo lo anterior sobre los colaboradores que tiene asignados, más configurar el programa, calificar competencias, validar visitas y KPIs, aprobar Account Plans y mover el marcador de semana."],
        ["Administrador", "Lo del mentor sobre cualquier colaborador, más dar de alta usuarios, asignar roles y editar la plantilla base de la que parten los programas nuevos."],
        ["Solo lectura", "Ve todo y usa los filtros, pero no modifica nada. Es el rol del gerente o de dirección."],
      ],
      ojo: "El colaborador no puede editar sus propias metas, ni validar su propia evidencia, ni aprobar sus propios Account Plans. No es desconfianza: si pudiera, el expediente no probaría nada ante un tercero.",
    },
    {
      id: "registrar",
      titulo: "Registrar a un colaborador y armarle el programa",
      para: "Lo que hace el mentor o el administrador antes de que la persona entre.",
      pasos: [
        ["Da de alta la cuenta", "En Usuarios y roles, con su correo y el rol de colaborador. El sistema genera una contraseña provisional que hay que pasarle."],
        ["Registra su ficha", "En Colaboradores: nombre, edad, puesto actual, puesto deseado, correo, teléfono y sucursal."],
        ["Pon las fechas", "La de inicio y la de término previsto. Si dejas vacío el término, el sistema lo calcula a 20 semanas. Estas fechas son las que alimentan todo el cálculo de ritmo."],
        ["Vincúlalo a su cuenta", "Es el paso que se olvida. Sin esa liga, la persona entra pero no ve su propio expediente."],
        ["Configura su programa", "En Configurar programa se ajusta a esa persona: las semanas y sus tareas, las competencias con su nivel requerido, los KPIs con metas por mes y los criterios de graduación con sus puntos."],
        ["Califica el corte inicial", "En Competencias, el corte «Inicial». Es la línea base contra la que después se mide cuánto creció. Sin ella, el avance no se puede leer."],
      ],
      ojo: "Revisa el programa con el colaborador antes de arrancar. Él puede verlo desde el primer día pero no cambiarlo, y una meta mal puesta se descubre tarde.",
    },
    {
      id: "semana",
      titulo: "La rutina de cada semana",
      para: "Lo que se repite 20 veces. Es el corazón del programa.",
      pasos: [
        ["El colaborador empieza", "Nadie valida nada hasta que él capturó algo. En Ruta de 20 semanas abre su semana y palomea cada tarea al terminarla."],
        ["Con evidencia", "Cada tarea tiene un botón para agregar evidencia: una liga, un archivo o una descripción. Una tarea palomeada sin evidencia es una afirmación; con evidencia es un hecho."],
        ["Visitas el mismo día", "En Visitas de campo: empresa, fecha, tipo, si es cuenta nueva, los hallazgos y la próxima acción comprometida con su fecha."],
        ["Oportunidades y cuentas", "En Pipeline, cada oportunidad real con su etapa, valor y próxima acción. En Cuentas, el mapeo de las cuentas objetivo."],
        ["El mentor revisa", "Marca como validadas las visitas bien ejecutadas y aprueba los Account Plans completos. Solo lo aprobado y lo validado cuenta para la graduación."],
        ["La sesión semanal", "Se sientan juntos y el mentor la registra en Coaching: logros, brechas, acuerdos y una calificación."],
      ],
      ojo: "El tipo de visita importa: el programa espera que la persona vaya pasando de observar al mentor a ir sola. Si todas quedan como «acompañado», la gráfica lo muestra.",
    },
    {
      id: "mes",
      titulo: "El cierre de cada mes",
      para: "Cuatro cosas, en orden.",
      pasos: [
        ["El colaborador captura sus KPIs", "En KPIs hay una cuadrícula con un renglón por indicador y una columna por mes. Escribe el número real que logró."],
        ["El mentor los valida", "Junto a cada número hay una casilla que solo él puede marcar. Un KPI sin validar no suma a la graduación, aunque el número esté capturado."],
        ["El mentor califica competencias", "Del 1 al 5 en el corte del mes que termina. Hay seis cortes: Inicial, Mes 1, Mes 2, Mes 3, Mes 4 y Mes 5."],
        ["El mentor mueve el marcador de semana", "Es el selector de la barra superior, y solo lo mueve quien puede editar el programa."],
      ],
      ojo: "Las competencias marcadas como críticas bloquean el dictamen de apto si quedan por debajo de su nivel requerido, aunque los puntos alcancen. Una crítica baja en el mes 3 todavía se puede levantar; en el mes 5 ya no.",
    },
    {
      id: "indicadores",
      titulo: "Cómo leer los indicadores del panel",
      para: "Cinco medidores, y no dicen lo mismo.",
      pasos: [
        ["Ritmo del programa", "Compara en qué semana debería ir por calendario contra en qué semana la tiene marcada el mentor. El cálculo usa días hábiles y descuenta los festivos oficiales, así que un puente no genera un atraso falso."],
        ["Tacómetro de cumplimiento", "El porcentaje de tareas hechas de las que ya tocaban. Verde arriba de 95 %, ámbar entre 70 y 95, rojo abajo de 70."],
        ["Tareas pendientes acumuladas", "No se reinicia cada semana. Lo que quedó pendiente en la semana 2 sigue contándose en la 9. Y adelantar trabajo de una semana futura no lo tapa: eso se reporta aparte."],
        ["Semáforo por semana", "En Ruta de 20 semanas. Verde si está completa, ámbar a medias, rojo si ya venció y le faltan tareas. Gris es una semana que todavía no toca."],
        ["Puntos de graduación", "El medidor grande. Cada criterio cumplido suma puntos; la aguja es el avance hacia el dictamen."],
      ],
      ojo: "La combinación a la que hay que hacer caso: ritmo en verde y tacómetro en rojo. Significa que el marcador va al día pero la evidencia no. Por fuera parece que todo va bien.",
    },
    {
      id: "graduacion",
      titulo: "La graduación y el dictamen",
      para: "Qué se evalúa al final del mes 5.",
      pasos: [
        ["Lo acumulado", "Pipeline calificado, ventas cerradas, visitas lideradas solo, Account Plans aprobados, KPIs validados y competencias. Todo eso ya venía sumando desde el primer día."],
        ["Lo que se captura al final", "El mentor registra la calificación del examen final, el promedio de role plays y la evaluación del gerente, las tres en la sección de Graduación."],
        ["Apto", "Los puntos mínimos, el scorecard en el nivel requerido y ninguna competencia crítica por debajo. Pasa a ventas externas."],
        ["Apto con plan de desarrollo", "Puntos intermedios con un scorecard aceptable. Pasa, con un plan de refuerzo acordado."],
        ["No apto aún", "Por debajo del mínimo. Se extiende el programa o se replantea la posición."],
      ],
      ojo: "Los umbrales exactos están escritos con sus números en la sección de Graduación, y el administrador puede ajustarlos en la plantilla base. Conviene que el colaborador los conozca desde el principio.",
    },
    {
      id: "varios",
      titulo: "Llevar varios colaboradores a la vez",
      para: "Para el mentor y el administrador.",
      pasos: [
        ["Cambiar de persona", "El selector de la barra superior cambia el expediente que estás viendo. Todas las secciones individuales siguen a ese selector."],
        ["Compararlos", "Resumen general pone a todos lado a lado, con gráficas de avance, ritmo y scorecard. Es la vista para la junta de seguimiento."],
        ["Riesgos", "Señala a quién conviene mirar de cerca: atrasos, competencias críticas bajas, pipeline flaco. No está disponible para el colaborador."],
        ["Archivar", "Un colaborador que termina o que sale del programa se archiva en vez de borrarse, para conservar el expediente. Borrarlo elimina todo su historial."],
      ],
      ojo: "El mentor solo puede editar los programas de los colaboradores que tiene asignados. El administrador puede con todos.",
    },
    {
      id: "usuarios",
      titulo: "Administrar usuarios y roles",
      para: "Solo para el administrador.",
      pasos: [
        ["Dar de alta", "En Usuarios y roles, con correo y rol. Si la persona ya tiene cuenta en otra herramienta de ISEL, se reutiliza esa misma cuenta."],
        ["Cambiar el rol", "Se cambia en caliente. La persona lo ve la próxima vez que recarga."],
        ["Desactivar", "Quitarle el acceso conserva su historial. Es lo que conviene cuando alguien deja el puesto."],
        ["Quitar el acceso", "No se puede quitar el acceso a alguien que está ligado a un expediente de colaborador, ni dejar el sistema sin administradores activos. El sistema lo impide."],
      ],
      ojo: "Esta herramienta comparte las cuentas con las otras aplicaciones de ISEL, pero no los accesos: dar de alta a alguien aquí no le abre las demás.",
    },
    {
      id: "plantilla",
      titulo: "La plantilla base",
      para: "De dónde sale el programa de cada persona nueva. Solo para el administrador.",
      pasos: [
        ["Qué es", "El programa estándar: 20 semanas con sus tareas, las competencias, los KPIs y los criterios de graduación con sus puntos y umbrales."],
        ["Cuándo se usa", "Al registrar un colaborador, se le copia la plantilla tal como esté en ese momento."],
        ["Qué pasa si la cambias", "Los programas ya creados no se tocan. Cambiarla afecta solo a quien se registre después, y eso es a propósito: a nadie se le mueven las metas a media carrera."],
        ["Ajustes por persona", "Lo individual se hace en Configurar programa, sobre el expediente de esa persona, sin tocar la plantilla."],
      ],
    },
    {
      id: "cuenta",
      titulo: "Tu cuenta y el modo oscuro",
      para: "Lo que cualquiera puede cambiar de lo suyo.",
      pasos: [
        ["Cambiar tu contraseña", "En Mi cuenta, cuando quieras. Nadie más puede verla, ni el administrador."],
        ["Ver qué permite tu rol", "Mi cuenta describe en palabras lo que tu rol puede y no puede hacer."],
        ["Modo oscuro", "El botón está abajo, en el menú lateral. La preferencia se recuerda en ese navegador."],
        ["Desde el celular", "Entra a la misma dirección. Para registrar una visita al salir de planta es lo más práctico."],
      ],
    },
  ],

  faq: [
    ["Marqué una tarea pero el tacómetro no se movió.",
      "El tacómetro mide las tareas de las semanas ya vencidas. Si marcaste una de una semana futura, cuenta como trabajo adelantado y se reporta aparte, debajo del medidor."],
    ["Se me juntaron varias semanas sin marcar nada. ¿Ya no cuenta?",
      "Sí cuenta. El sistema no cierra las semanas: márcalas cuando puedas, aunque sean de semanas pasadas. Lo que no desaparece es el pendiente acumulado mientras no lo marques."],
    ["Capturé mis KPIs pero no suben mis puntos de graduación.",
      "Un resultado de KPI cuenta cuando el mentor lo valida. Mientras tenga el número capturado pero sin palomear, no suma. Es la causa más común de puntos que no avanzan."],
    ["¿Por qué mi colaborador no ve la sección de Riesgos?",
      "Riesgos compara a todos los participantes entre sí, así que no está disponible para el rol de colaborador. Por eso en su menú el número 8 no aparece."],
    ["Me equivoqué al capturar una visita.",
      "Puedes editarla. Si el mentor ya la validó, avísale: la corrección puede cambiar su visto bueno."],
    ["El colaborador aparece atrasado pero no lo está.",
      "Casi siempre es el marcador de semana, que solo mueve el mentor. Si las tareas van al día y el marcador no, el panel lo dice con todas sus letras. Muévelo y el ritmo se corrige."],
    ["Nos paramos un mes por un viaje. ¿Se puede ajustar?",
      "Sí. El mentor cambia la fecha de término prevista en la ficha del colaborador y todo el cálculo de ritmo se recalcula solo."],
    ["¿Los fines de semana y los festivos cuentan como atraso?",
      "No. La semana esperada se calcula sobre días hábiles y descuenta los días de descanso obligatorio de la Ley Federal del Trabajo. No incluye Semana Santa ni los puentes que decide la empresa; si ISEL descansa otros días, se pueden agregar."],
    ["¿Puedo cambiar mis propias metas?",
      "No, si eres el colaborador. Las define el mentor o el administrador. Lo que sí puedes es verlas completas desde el primer día, y ese es el momento de decir si alguna no refleja tu realidad."],
    ["Cambié la plantilla base y los programas en curso siguen igual.",
      "Así está diseñado. La plantilla se copia al registrar a cada persona; cambiarla después solo afecta a quien se registre a partir de ese momento. A nadie se le mueven las metas a media carrera."],
    ["¿Qué pasa si borro a un colaborador?",
      "Se pierde todo su historial: tareas, visitas, oportunidades, evaluaciones. Si solo terminó el programa o salió, archívalo: conserva el expediente y deja de aparecer en las listas activas."],
    ["¿Dónde veo la dirección de la página para pasársela a alguien?",
      "Es la misma que estás usando. Cópiala de la barra del navegador. Quien la abra necesita además una cuenta dada de alta por el administrador."],
  ],

  fallas: [
    ["La página se queda en «Cargando…»",
      "Se interrumpió la conexión con el servidor, o una extensión del navegador está bloqueando la petición.",
      "Recarga. Si sigue, prueba en una ventana privada: eso descarta las extensiones."],
    ["«Un administrador debe concederte acceso»",
      "Tu cuenta existe pero no tiene rol en esta herramienta, o te lo desactivaron.",
      "Pídeselo al administrador. Él lo resuelve en Usuarios y roles, y lo ves al recargar."],
    ["«Correo o contraseña incorrectos»",
      "La contraseña no coincide, o estás usando la provisional después de haberla cambiado.",
      "Usa «Olvidé mi contraseña». Llega un correo con un enlace que te deja elegir una nueva."],
    ["El enlace del correo dice que caducó",
      "Los enlaces de restablecimiento vencen, y además solo sirven una vez.",
      "Pide otro desde «Olvidé mi contraseña» y ábrelo en cuanto llegue."],
    ["Guardo algo y no se queda",
      "La sesión caducó mientras la pestaña estaba abierta, así que el servidor rechaza la escritura.",
      "Recarga la página y vuelve a entrar. Lo que ya se había guardado antes no se pierde."],
    ["No veo una sección que alguien me mencionó",
      "Esa sección no está disponible para tu rol, o requiere tener un colaborador seleccionado.",
      "Mira en Mi cuenta qué permite tu rol. Si necesitas más, pídeselo al administrador."],
    ["El selector de colaborador no aparece",
      "Solo lo ven el mentor, el administrador y el rol de solo lectura. El colaborador ve únicamente su propio expediente.",
      "Si eres mentor y no aparece, es que no tienes colaboradores asignados todavía."],
    ["Los números del panel no cuadran con lo que capturé",
      "Casi siempre falta la validación del mentor, o el dato quedó en otro mes del que creías.",
      "Revisa en KPIs que el mes sea el correcto y que la casilla de validado esté marcada."],
    ["La página se ve mal o encimada",
      "La ventana es muy angosta, o el navegador quedó con una versión vieja en memoria.",
      "Ensancha la ventana y recarga forzando la actualización: Ctrl+Shift+R, o Cmd+Shift+R en Mac."],
    ["En el celular no alcanzo a ver una tabla completa",
      "Las tablas anchas se desplazan dentro de su propio marco.",
      "Arrastra la tabla de lado con el dedo. Para capturar mucho de golpe, conviene la computadora."],
  ],
};
