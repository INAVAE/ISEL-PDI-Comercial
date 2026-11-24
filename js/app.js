/* ===========================================================================
   Aplicación principal: sesión, permisos por rol, navegación y carga de datos.
   =========================================================================== */

import { auth, miPerfil, colaboradores, cargarExpediente, plantilla, perfiles,
  enlaceRecuperacion, errorEnlace } from "./db.js";
import { h, vaciar, boton, entrada, campo, aviso, lampara, cls, modal, cerrarModal, panel, dinero, botonTema, botonTemaIcono, iniciarTema, fecha, etiquetaRol } from "./ui.js";
import { metricas } from "./metricas.js";
import { vistaResumen, vistaColaboradores, vistaUsuarios, vistaPlantilla, vistaCuenta } from "./vistas-gestion.js";
import { vistaPanel, vistaRuta, vistaCompetencias, vistaKpis, vistaGraduacion, vistaRiesgos, vistaConfiguracion } from "./vistas-programa.js";
import { vistaVisitas, vistaPipeline, vistaCuentas, vistaCoaching } from "./vistas-actividad.js";
import { vistaAyuda, recargarSugerencias } from "./vistas-ayuda.js";
import { vistaRecordatorios } from "./vistas-recordatorios.js";
import { icono } from "./iconos.js";

const raiz = document.getElementById("app");

export const estado = {
  perfil: null,
  colaboradores: [],
  colId: null,
  col: null,
  exp: null,
  m: null,
  vista: "panel",
  plantillaGlobal: null,
  perfilesCache: [],
  /* Recuerda pestañas y filtros para que no se reinicien al guardar */
  /* semanasAbiertas: qué semanas de la ruta quedaron desplegadas. Vive aquí
     y no en el DOM porque cada refresco vuelve a pintar la vista. */
  sugerencias: null, sugPendientes: 0,
  /* semanaVista: qué semana se está mirando. null = la que toca por
     calendario. No se guarda en el expediente: mirar otra semana no debe
     cambiarle el plan a nadie. */
  ui: { corteCompetencias: null, mesRuta: null, pestanaConfig: "plan", semanasAbiertas: null,
        semanaVista: null,
        ayudaTab: "guia", ayudaCap: null, ayudaFaq: null, sugForm: null, sugFiltro: "",
        rielPlegado: false },
};

/* ------------------------------------------------------ RIEL PLEGADO ----- */

/* Plegado o desplegado se recuerda entre sesiones: quien trabaja en una
   pantalla angosta lo quiere plegado siempre, y volver a plegarlo en cada
   entrada sería pedirle lo mismo todos los días. En modo privado, o con el
   almacenamiento bloqueado, simplemente no se recuerda. */
const LLAVE_RIEL = "pdc-riel-plegado";
const leerRiel = () => { try { return localStorage.getItem(LLAVE_RIEL) === "1"; } catch { return false; } };
const guardarRiel = (v) => { try { localStorage.setItem(LLAVE_RIEL, v ? "1" : "0"); } catch { /* modo privado */ } };

/* --------------------------------------------------- SEMANA EN FOCO ------ */

/* En qué semana del programa va la persona HOY. Sale del calendario, no de
   un campo que alguien tenga que mantener: con varios planes arrancados en
   fechas distintas, averiguarlo a mano era comparar la fecha de inicio de
   cada quien contra la de hoy antes de poder revisar nada. */
export const semanaEnCurso = () => {
  const total = (estado.col?.plan || []).length || 1;
  const cal = estado.m?.cal;
  /* Sin fecha de inicio no hay calendario del que deducirla: queda lo último
     que se haya guardado en la ficha. */
  if (!cal || cal.sinFecha) return Math.max(1, Math.min(total, estado.col?.semana_actual || 1));
  if (cal.porArrancar) return 1;
  return Math.max(1, Math.min(total, cal.exigible || 1));
};

/* La que se está mirando: la en curso, salvo que se haya navegado a otra. */
export const semanaVista = () => {
  const total = (estado.col?.plan || []).length || 1;
  const v = estado.ui.semanaVista;
  return v ? Math.max(1, Math.min(total, v)) : semanaEnCurso();
};

/* ------------------------------------------------------------- PERMISOS -- */

export const permisos = {
  get rol() { return estado.perfil ? estado.perfil.rol : null; },
  get esAdmin() { return permisos.rol === "admin"; },
  get esMentor() { return permisos.rol === "mentor" || permisos.esAdmin; },
  get esColaborador() { return permisos.rol === "colaborador"; },
  get esLector() { return permisos.rol === "lector"; },
  /* El mentor solo edita el plan de los colaboradores que tiene asignados */
  editaPrograma(col) {
    if (permisos.esAdmin) return true;
    return permisos.rol === "mentor" && col && col.mentor_id === estado.perfil.id;
  },
  evalua(col) { return permisos.editaPrograma(col); },
  /* El colaborador captura su propia actividad; el mentor puede corregirla.
     El rol de solo lectura nunca escribe. */
  captura(col) {
    if (!col || permisos.esLector) return false;
    return permisos.editaPrograma(col) || col.user_id === estado.perfil.id;
  },
};

/* ---------------------------------------------------------------- MENÚ --- */

const TODOS = ["admin", "mentor", "colaborador", "lector"];
const GESTION = ["admin", "mentor", "lector"];

const MENU = [
  { id: "resumen", nombre: "Resumen general", roles: GESTION, grupo: "Gestión" },
  { id: "colaboradores", nombre: "Colaboradores", roles: GESTION, grupo: "Gestión" },
  /* Los diez módulos del programa van numerados en el orden en que se usan,
     para poder referirse a ellos por número entre mentor y colaborador. El
     número es fijo: no se recalcula según lo que cada rol alcanza a ver, para
     que "el 6" signifique lo mismo para todos. */
  { id: "panel", n: 1, nombre: "Panel", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "ruta", n: 2, nombre: "Plan de trabajo", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "visitas", n: 3, nombre: "Visitas de campo", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "pipeline", n: 4, nombre: "Pipeline", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "cuentas", n: 5, nombre: "Cuentas", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "kpis", n: 6, nombre: "KPIs", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "competencias", n: 7, nombre: "Competencias", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "riesgos", n: 8, nombre: "Riesgos", roles: GESTION, grupo: "Desarrollo", requiereCol: true },
  { id: "coaching", n: 9, nombre: "Coaching", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "graduacion", n: 10, nombre: "Graduación", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "configuracion", nombre: "Configurar programa", roles: ["admin", "mentor"], grupo: "Administración", requiereCol: true },
  { id: "plantilla", nombre: "Plantilla base", roles: ["admin"], grupo: "Administración" },
];

/* Lo que vive en el menú de la persona y no en el riel: su cuenta y la
   administración de quién entra y a quién le llegan los correos. No es
   navegación del programa —no se consulta mientras se revisa a alguien—,
   así que ocupaba sitio en el riel sin ganárselo.
   Cada entrada declara sus roles igual que el menú principal, y el filtro
   es el mismo: un lector no ve «Usuarios y roles» por ningún camino. */
const MENU_USUARIO = [
  { id: "cuenta", nombre: "Mi cuenta", roles: TODOS },
  { id: "recordatorios", nombre: "Recordatorios", roles: ["admin"] },
  { id: "usuarios", nombre: "Usuarios y roles", roles: ["admin"] },
];

const menuUsuarioVisible = () => MENU_USUARIO.filter((x) => x.roles.includes(permisos.rol));

const VISTAS = {
  resumen: vistaResumen, colaboradores: vistaColaboradores, usuarios: vistaUsuarios,
  plantilla: vistaPlantilla, cuenta: vistaCuenta, recordatorios: vistaRecordatorios,
  panel: vistaPanel, ruta: vistaRuta, competencias: vistaCompetencias, kpis: vistaKpis,
  graduacion: vistaGraduacion, riesgos: vistaRiesgos, configuracion: vistaConfiguracion,
  visitas: vistaVisitas, pipeline: vistaPipeline, cuentas: vistaCuentas, coaching: vistaCoaching,
  ayuda: vistaAyuda,
};

/* ---------------------------------------------------------------- CARGA -- */

export async function recargarColaboradores() {
  estado.colaboradores = await colaboradores.listar();
  if (estado.colId && !estado.colaboradores.some((c) => c.id === estado.colId)) estado.colId = null;
  if (!estado.colId) {
    const propio = estado.colaboradores.find((c) => c.user_id === estado.perfil.id);
    const activos = estado.colaboradores.filter((c) => c.estado === "activo");
    estado.colId = (propio || activos[0] || estado.colaboradores[0] || {}).id || null;
  }
}

export async function recargarExpediente() {
  if (!estado.colId) { estado.col = null; estado.exp = null; estado.m = null; return; }
  estado.col = await colaboradores.leer(estado.colId);
  if (!estado.col) { estado.colId = null; estado.exp = null; estado.m = null; return; }
  estado.exp = await cargarExpediente(estado.colId);
  estado.m = metricas(estado.col, estado.exp);
}

/* pintar() reconstruye la página entera, así que el navegador pierde la
   posición del scroll. Al marcar una tarea eso mandaba al usuario hasta
   arriba. Se guarda y se repone en el mismo cuadro, antes de pintar nada. */
function conservandoScroll(fn) {
  const y = window.scrollY;
  fn();
  requestAnimationFrame(() => window.scrollTo(0, y));
}

export async function refrescar(vista) {
  if (vista) estado.vista = vista;
  await recargarExpediente();
  conservandoScroll(pintar);
}

export async function refrescarTodo(vista) {
  await recargarColaboradores();
  await recargarExpediente();
  if (vista) estado.vista = vista;
  conservandoScroll(pintar);
}

/* Vuelve a dibujar todo con los datos que ya hay, conservando el scroll.
   Lo necesitan las vistas que cambian algo mostrado en la cabecera, como
   el contador del botón de ayuda. */
export const repintar = () => conservandoScroll(pintar);

export const ir = (vista) => { estado.vista = vista; pintar(); window.scrollTo(0, 0); };

export async function elegirColaborador(id) {
  estado.colId = id;
  /* Otro colaborador va en otra semana: lo desplegado del anterior no aplica */
  estado.ui.semanasAbiertas = null;
  estado.ui.mesRuta = null;
  /* Y se vuelve a la semana en curso. Antes había que mirar la fecha de
     inicio de cada quien y contar para saber qué semana tocaba revisar; con
     varios planes arrancados en fechas distintas eso era media revisión. */
  estado.ui.semanaVista = null;
  await recargarExpediente();
  pintar();
}

/* --------------------------------------------------------------- PINTAR -- */

export function pintar() {
  const menu = MENU.filter((x) => x.roles.includes(permisos.rol));
  const disponible = menu.filter((x) => !x.requiereCol || estado.col);
  /* La ayuda y el menú de la persona se abren desde la barra superior, no
     desde el riel, así que no están en MENU y hay que dejarlos pasar por su
     cuenta. Se respetan los roles: lo que menuUsuarioVisible() no devuelve
     tampoco se puede abrir escribiendo la vista. */
  const fueraDelRiel = new Set(["ayuda", ...menuUsuarioVisible().map((x) => x.id)]);
  if (!fueraDelRiel.has(estado.vista) && !disponible.some((x) => x.id === estado.vista))
    estado.vista = disponible[0] ? disponible[0].id : "cuenta";

  const grupos = [...new Set(menu.map((x) => x.grupo))];
  const plegado = estado.ui.rielPlegado;

  const alternarRiel = () => {
    estado.ui.rielPlegado = !estado.ui.rielPlegado;
    guardarRiel(estado.ui.rielPlegado);
    conservandoScroll(pintar);
  };

  const botonPlegar = h("button", {
    class: "rail-plegar", type: "button",
    title: plegado ? "Mostrar los nombres del menú" : "Dejar solo los iconos del menú",
    "aria-label": plegado ? "Desplegar el menú" : "Plegar el menú",
    "aria-expanded": plegado ? "false" : "true",
    onclick: alternarRiel,
  }, icono(plegado ? "desplegar" : "plegar", 19));

  const rail = h("aside", { class: "rail" },
    h("div", { class: "rail-marca" },
      h("div", { class: "rail-cabeza" },
        h("div", { class: "rail-nombre" },
          h("strong", { text: "ISEL" }),
          h("span", { text: "Plan de desarrollo comercial" })),
        botonPlegar)),
    h("nav", {}, ...grupos.map((g) =>
      h("div", { class: "rail-grupo" },
        h("span", { class: "rail-grupo-tit", text: g }),
        ...menu.filter((x) => x.grupo === g).map((x) => {
          const bloqueado = x.requiereCol && !estado.col;
          /* El título lleva el número además del nombre: plegado es lo único
             que queda para saber cuál es cada icono, y desplegado no estorba. */
          return h("button", {
            class: cls("rail-btn", estado.vista === x.id && "activo", bloqueado && "inactivo"),
            disabled: bloqueado,
            title: (x.n ? x.n + " · " : "") + x.nombre
              + (bloqueado ? " (elige un colaborador primero)" : ""),
            onclick: () => ir(x.id),
          },
            h("span", { class: "rail-ico" }, icono(x.id)),
            /* El número va en su propio elemento para que quede alineado en
               columna y el nombre no se desacomode entre un dígito y dos */
            x.n ? h("span", { class: "rail-n", text: x.n }) : null,
            h("span", { class: "rail-txt", text: x.nombre }));
        })))),
    );

  const individual = !!(menu.find((x) => x.id === estado.vista) || {}).requiereCol;
  const barraSuperior = cabecera(individual);
  const lienzo = h("div", { class: "lienzo" });

  vaciar(raiz).appendChild(h("div", { class: cls("app", plegado && "riel-plegado") }, rail,
    h("main", { class: "main" }, barraSuperior, lienzo)));

  try {
    const vista = VISTAS[estado.vista];
    lienzo.appendChild(vista({ estado, permisos, ir, refrescar, refrescarTodo, elegirColaborador, repintar,
      semanaVista, semanaEnCurso }));
  } catch (err) {
    console.error(err);
    lienzo.appendChild(panel("No se pudo mostrar esta sección",
      "Revisa la consola del navegador para ver el detalle.", h("pre", { class: "error-detalle", text: String(err.message || err) })));
  }
}

function cabecera(individual) {
  const col = individual ? estado.col : null;
  const m = individual ? estado.m : null;
  const visibles = estado.colaboradores.filter((c) => c.estado !== "archivado" || c.id === estado.colId);

  const selector = individual && (permisos.esMentor || permisos.esLector) && visibles.length
    ? h("div", { class: "mini" }, h("span", { text: "Colaborador" }),
      (() => {
        /* Un mentor puede llevar su propio plan en paralelo, así que su
           expediente aparece en la misma lista que los demás: se marca para
           que no tenga que adivinar cuál es el suyo. */
        const s = h("select", {}, ...visibles.map((c) =>
          h("option", { value: c.id, selected: c.id === estado.colId },
            c.nombre
            + (c.user_id && c.user_id === estado.perfil.id ? " (tu propio plan)" : "")
            + (c.estado === "archivado" ? " (archivado)" : ""))));
        s.addEventListener("change", () => elegirColaborador(s.value));
        return s;
      })())
    : null;

  return h("header", { class: "barra-estado" },
    h("div", {},
      h("h1", { text: col ? col.nombre : "Plan de desarrollo comercial" }),
      h("p", {
        text: col
          ? `${col.puesto_actual || "Puesto actual sin definir"} → ${col.puesto_deseado || "Puesto objetivo sin definir"}${col.sucursal ? " · " + col.sucursal : ""}`
          : `${estado.colaboradores.filter((c) => c.estado === "activo").length} colaboradores en desarrollo · de vendedor interno a consultor comercial`
      })),
    h("div", { class: "barra-estado-der" },
      selector,
      col && h("div", { class: "mini" }, h("span", { text: "Semana" }),
        (() => {
          const total = (col.plan || []).length || 20;
          const enCurso = semanaEnCurso();
          const vista = semanaVista();
          /* Navegación, no un dato del expediente: mover esto cambia lo que
             se está mirando y nada más. Antes guardaba la semana en la ficha
             del colaborador, así que no se podía revisar una semana anterior
             sin modificarle el plan. */
          const s = h("select", { title: "Qué semana del programa estás mirando" },
            ...Array.from({ length: total }, (_, i) =>
              h("option", { value: i + 1, selected: vista === i + 1 },
                `${i + 1} de ${total}${i + 1 === enCurso ? " · en curso" : ""}`)));
          s.addEventListener("change", () => {
            const n = Number(s.value);
            estado.ui.semanaVista = n === enCurso ? null : n;
            estado.ui.semanasAbiertas = null;
            estado.ui.mesRuta = null;
            pintar();
          });
          return vista === enCurso
            ? s
            : h("span", { class: "semana-nav" }, s,
              boton("Volver a la semana en curso", () => {
                estado.ui.semanaVista = null;
                estado.ui.semanasAbiertas = null;
                estado.ui.mesRuta = null;
                pintar();
              }, "ghost"));
        })()),
      m && m.cal && !m.cal.sinFecha && h("div", { class: "mini" },
        h("span", { text: "Programa" }),
        h("b", { class: "mini-dato", title: "Inicio y término previsto" },
          `${fecha(m.cal.inicio)} \u2192 ${fecha(m.cal.fin)}`)),
      m && m.cal && h("div", { class: "mini" }, h("span", { text: "Ritmo" }), lampara(m.cal.estado, m.cal.veredicto)),
      m && h("div", { class: "mini" }, h("span", { text: "Avance del plan" }), h("b", { text: m.avanceTareas + "%" })),
      m && h("div", { class: "mini" }, h("span", { text: "Scorecard" }), h("b", { text: m.score ? m.score.toFixed(2) : "—" })),
      m && h("div", { class: "mini" }, h("span", { text: "Dictamen" }), lampara(m.estado, m.dictamen))),
    barraAcciones());
}

/* Los tres controles de la esquina: ayuda, tema y la persona. Van anclados
   y fuera del grupo de indicadores porque ese grupo envuelve en pantallas
   angostas, y un elemento más ahí hacía crecer la cabecera. */
function barraAcciones() {
  return h("div", { class: "barra-acciones" }, botonAyuda(), botonTemaIcono(), menuUsuario());
}

/* La ayuda la ve cualquier rol: la duda de cómo se usa algo no distingue
   entre mentor y colaborador. El contador solo aparece para el
   administrador, que es quien atiende el buzón. */
function botonAyuda() {
  const pend = permisos.esAdmin ? (estado.sugPendientes || 0) : 0;
  const b = h("button", {
    class: cls("barra-ico", "ayuda-btn", estado.vista === "ayuda" && "activo"),
    title: "Ayuda: manual, preguntas frecuentes y buzón de observaciones",
    "aria-label": "Ayuda",
    onclick: () => ir("ayuda"),
  },
    iconoAyuda(),
    pend ? h("span", { class: "ayuda-pin", text: String(pend) }) : null);
  return b;
}

/* Iniciales para el botón de la persona. Dos letras como mucho: con tres
   hay que encoger la tipografía y el círculo deja de leerse de un vistazo. */
const iniciales = (nombre, correo) => {
  const partes = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return String(correo || "?").slice(0, 2).toUpperCase();
};

/* El menú de la persona: quién es, qué puede administrar y la salida.
   Se abre y se cierra por su cuenta, sin pasar por estado.ui, porque
   pintar() reconstruye la página entera y un menú abierto guardado en el
   estado reaparecería tras cualquier refresco de fondo. */
function menuUsuario() {
  const perfil = estado.perfil;
  const items = menuUsuarioVisible();

  const btn = h("button", {
    class: "barra-ico usuario-btn", type: "button",
    title: `${perfil.nombre || perfil.email} · ${etiquetaRol(permisos.rol)}`,
    "aria-label": "Menú de tu cuenta",
    "aria-haspopup": "menu", "aria-expanded": "false",
  }, h("span", { class: "usuario-ini", text: iniciales(perfil.nombre, perfil.email) }));

  const lista = h("div", { class: "usuario-menu", role: "menu", hidden: true },
    h("div", { class: "usuario-quien" },
      h("b", { text: perfil.nombre || "Sin nombre" }),
      h("span", { class: "usuario-correo", text: perfil.email || "" }),
      h("span", { class: "usuario-rol", text: etiquetaRol(permisos.rol) })),
    h("div", { class: "usuario-sep" }),
    ...items.map((x) => h("button", {
      class: cls("usuario-op", estado.vista === x.id && "activo"),
      type: "button", role: "menuitem",
      onclick: () => { cerrar(); ir(x.id); },
    }, h("span", { class: "rail-ico" }, icono(x.id)), h("span", { text: x.nombre }))),
    h("div", { class: "usuario-sep" }),
    h("button", {
      class: "usuario-op", type: "button", role: "menuitem",
      onclick: async () => { cerrar(); await auth.salir(); location.reload(); },
    }, h("span", { class: "rail-ico" }, icono("salir")), h("span", { text: "Cerrar sesión" })));

  const caja = h("div", { class: "usuario-caja" }, btn, lista);

  function fuera(e) {
    /* Si pintar() ya se llevó este menú del documento, el oyente sobra */
    if (!document.contains(caja) || !caja.contains(e.target)) cerrar();
  }
  function tecla(e) { if (e.key === "Escape") { cerrar(); btn.focus(); } }

  function cerrar() {
    lista.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", fuera, true);
    document.removeEventListener("keydown", tecla, true);
  }
  function abrir() {
    lista.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    /* En captura y añadidos dentro del propio clic: el clic que abre ya
       pasó por el documento, así que no se cierra solo al instante. */
    document.addEventListener("click", fuera, true);
    document.addEventListener("keydown", tecla, true);
  }

  btn.addEventListener("click", (e) => { e.stopPropagation(); lista.hidden ? abrir() : cerrar(); });
  return caja;
}

function iconoAyuda() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.9");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const d of ["M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4",
    "M9.4 9.3a2.7 2.7 0 1 1 3.4 3.1c-.6.2-.9.8-.9 1.4v.5",
    "M12 17.3h.01"]) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  }
  return svg;
}

/* ---------------------------------------------- PANTALLAS INTERMEDIAS --- */

/* La persona tiene cuenta en ISEL pero nadie le ha dado acceso aquí todavía,
   o un administrador se lo retiró. */
function pantallaSinAcceso() {
  vaciar(raiz).appendChild(h("div", { class: "login" },
    h("div", { class: "login-caja" },
      h("div", { class: "login-marca" }, h("strong", { text: "ISEL" }),
        h("span", { text: "Plan de desarrollo comercial" })),
      h("h2", { class: "sin-acceso-tit", text: "Todavía no tienes acceso" }),
      h("p", { class: "login-intro", text: `Tu cuenta ${estado.perfil.email} existe, pero un administrador debe concederte acceso a esta herramienta. Pídeselo y vuelve a entrar.` }),
      h("div", { class: "login-pie" }, botonTema(),
        boton("Cerrar sesión", async () => { await auth.salir(); location.reload(); }, "ghost")))));
}

/* Dos caminos llegan aquí y hay que entrar eligiendo contraseña:
   "temporal"     · primer ingreso con la contraseña que dio el administrador
   "recuperacion" · la persona abrió el enlace del correo de restablecimiento */
function pantallaCambioObligado(motivo = "temporal") {
  const intro = motivo === "recuperacion"
    ? "Abriste el enlace para restablecer tu contraseña. Escribe la nueva para continuar."
    : "Entraste con una contraseña temporal. Cámbiala por una tuya para continuar.";
  const p1 = h("input", { type: "password", placeholder: "Nueva contraseña", autocomplete: "new-password" });
  const p2 = h("input", { type: "password", placeholder: "Repite la contraseña", autocomplete: "new-password" });
  const error = h("p", { class: "login-error" });
  const btn = boton("Guardar y entrar", async () => {
    error.textContent = "";
    if (p1.value.length < 8) { error.textContent = "Usa al menos 8 caracteres."; return; }
    if (p1.value !== p2.value) { error.textContent = "Las dos contraseñas no coinciden."; return; }
    btn.disabled = true; btn.textContent = "Guardando…";
    try {
      await auth.cambiarPassword(p1.value);
      await perfiles.actualizar(estado.perfil.id, { debe_cambiar: false });
      estado.perfil.debe_cambiar = false;
      aviso("Contraseña actualizada");
      await continuarArranque();
    } catch (e) {
      error.textContent = e.message;
      btn.disabled = false; btn.textContent = "Guardar y entrar";
    }
  });

  vaciar(raiz).appendChild(h("div", { class: "login" },
    h("div", { class: "login-caja" },
      h("div", { class: "login-marca" }, h("strong", { text: "ISEL" }),
        h("span", { text: "Plan de desarrollo comercial" })),
      h("h2", { class: "sin-acceso-tit", text: "Elige tu contraseña" }),
      h("p", { class: "login-intro", text: intro }),
      h("form", { class: "login-form", onsubmit: (e) => { e.preventDefault(); btn.click(); } },
        campo("Nueva contraseña", p1), campo("Repite la contraseña", p2), error, btn),
      h("div", { class: "login-pie" }, botonTema()))));
}

/* --------------------------------------------------------------- LOGIN --- */

function pantallaAcceso(mensaje) {
  const email = h("input", { type: "email", placeholder: "correo@empresa.com", autocomplete: "username" });
  const pass = h("input", { type: "password", placeholder: "Contraseña", autocomplete: "current-password" });
  const error = h("p", { class: "login-error" });
  const btn = boton("Entrar", async () => {
    error.textContent = "";
    btn.disabled = true; btn.textContent = "Entrando…";
    try {
      await auth.entrar(email.value.trim(), pass.value);
      await arrancar();
    } catch (e) {
      error.textContent = traducirError(e.message);
      btn.disabled = false; btn.textContent = "Entrar";
    }
  });
  const form = h("form", { class: "login-form", onsubmit: (e) => { e.preventDefault(); btn.click(); } },
    campo("Correo", email), campo("Contraseña", pass), error, btn,
    h("button", {
      type: "button", class: "link", onclick: async () => {
        if (!email.value.trim()) { error.textContent = "Escribe tu correo para enviarte el enlace."; return; }
        try { await auth.recuperar(email.value.trim()); aviso("Te enviamos un correo para restablecer la contraseña"); }
        catch (e) { error.textContent = traducirError(e.message); }
      }
    }, "Olvidé mi contraseña"));

  vaciar(raiz).appendChild(h("div", { class: "login" },
    h("div", { class: "login-caja" },
      h("div", { class: "login-marca" }, h("strong", { text: "ISEL" }), h("span", { text: "Plan de desarrollo comercial" })),
      h("p", { class: "login-intro", text: "Entra con las credenciales que te dio el administrador del programa." }),
      mensaje && h("p", { class: "login-error", text: mensaje }),
      form,
      h("div", { class: "login-pie" }, botonTema()))));
}

const traducirError = (msg) =>
  /invalid login/i.test(msg) ? "Correo o contraseña incorrectos."
    : /email not confirmed/i.test(msg) ? "La cuenta todavía no está confirmada."
      : /(link|token).*(invalid|expired)|(invalid|expired).*(link|token)|otp_expired/i.test(msg)
        ? "El enlace del correo ya caducó o se usó antes. Pide otro con «Olvidé mi contraseña»."
        : /fetch|network/i.test(msg) ? "No se pudo contactar al servidor. Revisa la configuración de Supabase."
          : msg;

/* ------------------------------------------------------------- ARRANQUE -- */

export async function arrancar() {
  const sesion = await auth.sesion();
  // Un enlace caducado o ya usado regresa sin sesión y con el motivo en la URL
  if (!sesion) { pantallaAcceso(errorEnlace ? traducirError(errorEnlace) : undefined); return; }
  vaciar(raiz).appendChild(h("div", { class: "cargando", text: "Cargando el programa…" }));
  try {
    estado.perfil = await miPerfil();

    // Sin fila de perfil, o con el acceso desactivado, no se entra
    if (!estado.perfil || estado.perfil.sinAcceso || estado.perfil.activo === false) {
      pantallaSinAcceso();
      return;
    }
    // Llegó por el enlace de restablecimiento: la sesión sirve para elegir
    // contraseña, no para entrar de largo al programa
    if (enlaceRecuperacion) { pantallaCambioObligado("recuperacion"); return; }
    // Contraseña temporal pendiente de cambiar
    if (estado.perfil.debe_cambiar) { pantallaCambioObligado(); return; }

    await continuarArranque();
  } catch (e) {
    console.error(e);
    vaciar(raiz).appendChild(h("div", { class: "login" },
      h("div", { class: "login-caja" },
        h("h2", { text: "No se pudo cargar la información" }),
        h("p", { class: "login-intro", text: traducirError(e.message) }),
        boton("Cerrar sesión", async () => { await auth.salir(); location.reload(); }, "ghost"))));
  }
}

async function continuarArranque() {
  estado.plantillaGlobal = await plantilla.leer();
  try { estado.perfilesCache = await perfiles.listar(); } catch { estado.perfilesCache = []; }
  await recargarColaboradores();
  await recargarExpediente();
  /* El buzón no debe estorbar el arranque: si la tabla todavía no existe
     o falla, la ayuda sigue abriendo y solo esa pestaña avisa. */
  await recargarSugerencias({ estado, permisos });
  pintar();
}

/* Solo un cierre de sesión de verdad justifica recargar. Antes bastaba
   cualquier evento con la sesión nula —un refresco de token que falla al
   volver a la pestaña, que es justo lo que pasa al ir a copiar un dato de
   otro programa— para recargar la página y tirar el formulario abierto. */
auth.alCambiar((s, evt) => {
  if (evt === "SIGNED_OUT" && estado.perfil) location.reload();
});
estado.ui.rielPlegado = leerRiel();
iniciarTema();
arrancar();
