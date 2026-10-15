/* ===========================================================================
   Vistas de gestión: resumen comparativo, alta de colaboradores,
   usuarios y roles, plantilla base y cuenta propia.
   =========================================================================== */

import {
  colaboradores as dbCol, cargarResumenGlobal, perfiles, usuarios as dbUsuarios,
  plantilla as dbPlantilla, auth,
} from "./db.js";
import { resumenColaborador } from "./metricas.js";
import { clonarPlantilla } from "./plantilla.js";
import {
  h, panel, tabla, boton, campo, entrada, area, seleccion, modal, cerrarModal, aviso, confirmar,
  lampara, barra, dinero, numero, pct, fecha, vacio, radar, barras, barrasH, lineas, color, cls, tarjeta,
  barraFiltros, opcionesDe, encabezadoOrdenable, ordenar, tarjetaConteo,
} from "./ui.js";

const ETIQUETA_ROL = {
  admin: "Administrador", mentor: "Mentor",
  colaborador: "Colaborador en desarrollo", lector: "Solo lectura",
};
const OPCIONES_ROL = [
  { id: "colaborador", nombre: "Colaborador en desarrollo" },
  { id: "mentor", nombre: "Mentor" },
  { id: "lector", nombre: "Solo lectura" },
  { id: "admin", nombre: "Administrador" },
];

/* ======================================================= RESUMEN GENERAL == */

export function vistaResumen(ctx) {
  const cont = h("div", { class: "vista" });
  const ui = ctx.estado.ui;
  if (!ui.resumen) ui.resumen = { sucursal: "", mentor: "", estado: "activo", orden: { clave: "score", asc: false } };
  const f = ui.resumen;

  const todos = ctx.estado.colaboradores;
  if (!todos.length) {
    cont.appendChild(panel("Todav\u00eda no hay colaboradores en desarrollo", null,
      vacio("Sin participantes registrados",
        "Registra al primer colaborador para empezar a medir su avance.",
        ctx.permisos.esLector ? null : boton("Registrar colaborador", () => ctx.ir("colaboradores")))));
    return cont;
  }

  cont.appendChild(h("div", { class: "cargando-chico", text: "Calculando el comparativo\u2026" }));

  cargarResumenGlobal(todos.map((c) => c.id)).then((datos) => {
    const pintar = () => {
      cont.replaceChildren();

      const filtrados = todos.filter((c) =>
        (!f.estado || c.estado === f.estado) &&
        (!f.sucursal || c.sucursal === f.sucursal) &&
        (!f.mentor || c.mentor_id === f.mentor));

      const mentores = [...new Map(todos.filter((c) => c.mentor_id)
        .map((c) => [c.mentor_id, nombrePerfil(ctx, c.mentor_id)])).entries()]
        .map(([id, nombre]) => ({ id, nombre }));

      cont.appendChild(panel(null, null, barraFiltros([
        { label: "Sucursal", valor: f.sucursal, opciones: opcionesDe(todos, "sucursal", "Todas"),
          onChange: (v) => { f.sucursal = v; pintar(); } },
        { label: "Mentor", valor: f.mentor,
          opciones: [{ id: "", nombre: "Todos" }, ...mentores], onChange: (v) => { f.mentor = v; pintar(); } },
        { label: "Estado", valor: f.estado, opciones: [
          { id: "activo", nombre: "En desarrollo" }, { id: "graduado", nombre: "Graduados" },
          { id: "archivado", nombre: "Archivados" }, { id: "", nombre: "Todos" },
        ], onChange: (v) => { f.estado = v; pintar(); } },
      ], `${filtrados.length} de ${todos.length} colaboradores`,
        () => { f.sucursal = ""; f.mentor = ""; f.estado = "activo"; pintar(); })));

      if (!filtrados.length) {
        cont.appendChild(panel(null, null, vacio("Ning\u00fan colaborador coincide",
          "Prueba con otra sucursal, otro mentor u otro estado.")));
        return;
      }

      const r = ordenar(filtrados.map((c) => resumenColaborador(c, datos)), {
        ...f.orden,
        obtener: (x) => ({
          nombre: x.col.nombre, sucursal: x.col.sucursal || "", avance: x.avance, score: x.score,
          visitas: x.visitas, solo: x.visitasSolo, opps: x.opps, pipeline: x.pipeline,
          ventas: x.ventas, cuentas: x.cuentas, planes: x.planes,
        })[f.orden.clave],
      });

      const prom = (g) => r.reduce((a, x) => a + g(x), 0) / r.length;

      cont.appendChild(h("div", { class: "grid-4" },
        tarjeta("Colaboradores", r.length, `${todos.filter((c) => c.estado === "graduado").length} ya graduados`, 100),
        tarjeta("Scorecard promedio", prom((x) => x.score).toFixed(2), "Referencia de graduaci\u00f3n: 4.00", pct(prom((x) => x.score), 4)),
        tarjeta("Avance promedio del plan", Math.round(prom((x) => x.avance)) + "%", "Tareas completadas del programa", Math.round(prom((x) => x.avance))),
        tarjeta("Pipeline del grupo", dinero(r.reduce((a, x) => a + x.pipeline, 0)), `${r.reduce((a, x) => a + x.opps, 0)} oportunidades abiertas`, 100)));

      const alOrdenar = (o) => { f.orden = o; pintar(); };
      const enc = (t, clave, num) => encabezadoOrdenable(t, clave, f.orden, alOrdenar, num);

      cont.appendChild(panel("Comparativo de participantes",
        "Da clic en cualquier encabezado para ordenar, y en un rengl\u00f3n para abrir el expediente completo.",
        h("div", { class: "tabla-scroll" }, h("table", { class: "tabla" },
          h("thead", {}, h("tr", {},
            enc("Colaborador", "nombre"), enc("Sucursal", "sucursal"),
            enc("Avance", "avance", true), enc("Scorecard", "score", true),
            enc("Visitas", "visitas", true), enc("Solo", "solo", true),
            enc("Oportunidades", "opps", true), enc("Pipeline", "pipeline", true),
            enc("Ventas", "ventas", true), enc("Cuentas", "cuentas", true), enc("Planes", "planes", true))),
          h("tbody", {}, ...r.map((x) => h("tr", {
            class: "fila-click",
            onclick: () => ctx.elegirColaborador(x.col.id).then(() => ctx.ir("panel")),
          },
            h("td", {}, h("b", { text: x.col.nombre }), h("br"),
              h("span", { class: "gris", text: x.col.puesto_actual || "" })),
            h("td", { text: x.col.sucursal || "\u2014" }),
            h("td", { class: "num" }, String(x.avance) + "%",
              barra(x.avance, 100, x.avance >= 80 ? "var(--run)" : "var(--signal)")),
            h("td", { class: "num" }, h("b", { class: x.score >= 4 ? "verde-fuerte" : "", text: x.score ? x.score.toFixed(2) : "\u2014" })),
            h("td", { class: "num", text: String(x.visitas) }),
            h("td", { class: "num", text: String(x.visitasSolo) }),
            h("td", { class: "num", text: String(x.opps) }),
            h("td", { class: "num mono", text: dinero(x.pipeline) }),
            h("td", { class: "num mono", text: dinero(x.ventas) }),
            h("td", { class: "num", text: String(x.cuentas) }),
            h("td", { class: "num", text: String(x.planes) })))))))); 

      const nombres = r.map((x) => x.col.nombre.split(" ")[0]);
      cont.appendChild(h("div", { class: "grid-2" },
        panel("Scorecard por participante", "Nivel promedio ponderado en el \u00faltimo corte evaluado.",
          barrasH(r.map((x) => x.col.nombre), r.map((x) => Number(x.score.toFixed(2))),
            { colores: r.map((x) => (x.score >= 4 ? "var(--c-exito)" : x.score >= 3 ? "var(--c-aviso)" : "var(--c-falla)")),
              formato: (v) => v.toFixed(2) })),
        panel("Avance del plan de trabajo", "Porcentaje de tareas completadas de las 20 semanas.",
          barrasH(r.map((x) => x.col.nombre), r.map((x) => x.avance), { formato: (v) => Math.round(v) + "%" })),
        panel("Actividad de campo", "Visitas totales y las que ya lidera solo.",
          barras(nombres, [
            { nombre: "Visitas totales", color: color(0), valores: r.map((x) => x.visitas) },
            { nombre: "Lideradas solo", color: color(1), valores: r.map((x) => x.visitasSolo) },
          ])),
        panel("Pipeline y ventas", "Valor abierto contra valor cerrado por participante.",
          barras(nombres, [
            { nombre: "Pipeline abierto", color: color(3), valores: r.map((x) => x.pipeline) },
            { nombre: "Pipeline calificado", color: color(0), valores: r.map((x) => x.pipelineCal) },
            { nombre: "Ventas cerradas", color: color(1), valores: r.map((x) => x.ventas) },
          ], { formato: dinero, ml: 62 }))));

      const cortes = ["Inicial", "Mes 1", "Mes 2", "Mes 3", "Mes 4", "Mes 5"];
      cont.appendChild(h("div", { class: "grid-2" },
        panel("Evoluci\u00f3n del scorecard", "Una l\u00ednea por participante. La l\u00ednea roja marca el nivel de graduaci\u00f3n.",
          lineas(cortes, r.slice(0, 8).map((x, i) => ({ nombre: x.col.nombre.split(" ")[0], color: color(i), valores: x.serieScore })),
            { max: 5, referencia: 4, refTexto: "graduaci\u00f3n", alto: 280 })),
        panel("Perfil de competencias", "Promedio por grupo en el \u00faltimo corte de cada participante.",
          radar((r[0].grupos || []).map((g) => g.nombre.replace("Competencias ", "")),
            r.slice(0, 5).map((x, i) => ({
              nombre: x.col.nombre.split(" ")[0], color: color(i),
              valores: (x.grupos || []).map((g) => Number(x.promedioGrupo(g.id).toFixed(2))),
            }))))));

      const atencion = r.filter((x) => x.score > 0 && x.score < 3.5)
        .concat(r.filter((x) => x.avance < 40 && x.score === 0));
      cont.appendChild(panel("D\u00f3nde poner la atenci\u00f3n esta semana", null,
        h("ul", { class: "alertas" },
          ...(atencion.length
            ? atencion.map((x) => h("li", {}, lampara("signal",
              `${x.col.nombre}: scorecard ${x.score ? x.score.toFixed(2) : "sin evaluar"} y ${x.avance}% del plan completado`)))
            : [h("li", {}, lampara("run", "Todos los participantes van dentro de par\u00e1metros."))]),
          ...r.filter((x) => x.visitas > 0 && x.visitasSolo === 0 && x.avance > 50)
            .map((x) => h("li", {}, lampara("fault", `${x.col.nombre} a\u00fan no lidera ninguna visita solo`))))));
    };
    pintar();
  }).catch((e) => cont.replaceChildren(panel("No se pudo calcular el comparativo", e.message)));

  return cont;
}

/* ====================================================== COLABORADORES ===== */

export function vistaColaboradores(ctx) {
  const cont = h("div", { class: "vista" });
  const ui = ctx.estado.ui;
  if (!ui.colab) ui.colab = { busqueda: "", sucursal: "", mentor: "" };
  const f = ui.colab;
  const todos = ctx.estado.colaboradores;
  const puedeCrear = ctx.permisos.esAdmin || ctx.permisos.rol === "mentor";

  const grupos = [
    { id: "activo", nombre: "En desarrollo" },
    { id: "graduado", nombre: "Graduados" },
    { id: "archivado", nombre: "Archivados" },
  ];

  const pintar = () => {
    cont.replaceChildren();

    const coincide = (c) =>
      (!f.sucursal || c.sucursal === f.sucursal) &&
      (!f.mentor || c.mentor_id === f.mentor) &&
      (!f.busqueda || (`${c.nombre} ${c.email || ""} ${c.puesto_actual || ""}`)
        .toLowerCase().includes(f.busqueda.toLowerCase()));

    const filtrados = todos.filter(coincide);

    const mentores = [...new Map(todos.filter((c) => c.mentor_id)
      .map((c) => [c.mentor_id, nombrePerfil(ctx, c.mentor_id)])).entries()]
      .map(([id, nombre]) => ({ id, nombre }));

    cont.appendChild(h("div", { class: "head-flex" },
      h("div", {},
        h("h2", { class: "titulo-vista", text: "Colaboradores en desarrollo" }),
        h("p", { class: "sub", text: ctx.permisos.esLector
          ? "Consulta de solo lectura. Abre a cualquiera para ver su expediente completo."
          : "Cada colaborador tiene su propio plan de trabajo, sus objetivos y su expediente de evidencia." })),
      puedeCrear ? boton("Registrar colaborador", () => formColaborador(ctx, null)) : null));

    cont.appendChild(panel(null, null, barraFiltros([
      { tipo: "texto", id: "colaboradores", label: "Buscar", valor: f.busqueda, placeholder: "Nombre, correo o puesto",
        onChange: (v) => { f.busqueda = v; pintar(); } },
      { label: "Sucursal", valor: f.sucursal, opciones: opcionesDe(todos, "sucursal", "Todas"),
        onChange: (v) => { f.sucursal = v; pintar(); } },
      { label: "Mentor", valor: f.mentor, opciones: [{ id: "", nombre: "Todos" }, ...mentores],
        onChange: (v) => { f.mentor = v; pintar(); } },
    ], `${filtrados.length} de ${todos.length}`,
      () => { f.busqueda = ""; f.sucursal = ""; f.mentor = ""; pintar(); })));

    grupos.forEach((g) => {
      const lista = filtrados.filter((c) => c.estado === g.id);
      if (!lista.length && g.id !== "activo") return;
      cont.appendChild(panel(`${g.nombre} (${lista.length})`, null,
        lista.length
          ? tabla(["Nombre", "Puesto actual \u2192 objetivo", "Contacto", "Sucursal", "Mentor", "Inicio", ""],
            lista.map((c) => filaColaborador(ctx, c)), { scroll: true })
          : vacio(todos.some((c) => c.estado === g.id) ? "Ninguno coincide con el filtro" : "Sin colaboradores en esta lista",
            todos.some((c) => c.estado === g.id)
              ? "Prueba con otra sucursal u otro mentor."
              : "Registra a la persona que vas a desarrollar: nombre, puesto actual, puesto objetivo y sucursal.",
            puedeCrear && !todos.some((c) => c.estado === g.id)
              ? boton("Registrar colaborador", () => formColaborador(ctx, null)) : null)));
    });
  };

  pintar();
  return cont;
}

function filaColaborador(ctx, c) {
  const puedeEditar = ctx.permisos.editaPrograma(c);
  const acciones = h("td", { class: "acciones" },
    boton("Abrir", () => ctx.elegirColaborador(c.id).then(() => ctx.ir("panel")), "ghost"),
    puedeEditar ? boton("Editar", () => formColaborador(ctx, c), "ghost") : null,
    puedeEditar && c.estado === "activo" ? boton("Archivar", () => cambiarEstado(ctx, c, "archivado"), "ghost") : null,
    puedeEditar && c.estado !== "activo" ? boton("Reactivar", () => cambiarEstado(ctx, c, "activo"), "ghost") : null,
    puedeEditar && c.estado === "activo" ? boton("Graduar", () => cambiarEstado(ctx, c, "graduado"), "ghost") : null,
    ctx.permisos.esAdmin ? boton("Borrar", () => confirmar(
      `Se borrará a ${c.nombre} junto con todas sus visitas, oportunidades, cuentas y evaluaciones. Esta acción no se puede deshacer.`,
      async () => { await dbCol.borrar(c.id); aviso("Colaborador borrado"); ctx.refrescarTodo("colaboradores"); }), "ghost") : null);

  return h("tr", {},
    h("td", {}, h("b", { text: c.nombre }), c.edad ? h("span", { class: "gris", text: ` · ${c.edad} años` }) : null),
    h("td", {}, c.puesto_actual || "—", h("span", { class: "gris", text: " → " }), c.puesto_deseado || "—"),
    h("td", { class: "gris" }, c.email || "—", h("br"), c.telefono || ""),
    h("td", { text: c.sucursal || "—" }),
    h("td", { class: "gris", text: nombrePerfil(ctx, c.mentor_id) }),
    h("td", { class: "mono", text: c.fecha_inicio ? fecha(c.fecha_inicio) : "—" }),
    acciones);
}

function nombrePerfil(ctx, id) {
  if (!id) return "Sin asignar";
  const p = (ctx.estado.perfilesCache || []).find((x) => x.id === id);
  return p ? (p.nombre || p.email) : "Asignado";
}

async function cambiarEstado(ctx, c, estado) {
  await dbCol.actualizar(c.id, { estado });
  aviso(estado === "archivado" ? "Colaborador archivado" : estado === "graduado" ? "Colaborador marcado como graduado" : "Colaborador reactivado");
  ctx.refrescarTodo("colaboradores");
}

async function formColaborador(ctx, existente) {
  try { ctx.estado.perfilesCache = await perfiles.listar(); } catch { /* se usa lo que ya haya en memoria */ }
  const esNuevo = !existente;
  const f = existente ? { ...existente } : {
    nombre: "", edad: null, puesto_actual: "Vendedor interno", puesto_deseado: "Vendedor externo / Consultor comercial",
    email: "", telefono: "", sucursal: "", fecha_inicio: new Date().toISOString().slice(0, 10),
    notas: "", estado: "activo", mentor_id: ctx.permisos.rol === "mentor" ? ctx.estado.perfil.id : null, user_id: null,
  };
  const set = (k) => (v) => { f[k] = v; };

  const ps = ctx.estado.perfilesCache || [];
  const mentores = [{ id: "", nombre: "Sin asignar" }, ...ps.filter((p) => p.rol === "mentor" || p.rol === "admin").map((p) => ({ id: p.id, nombre: p.nombre || p.email }))];
  const usuarios = [{ id: "", nombre: "Sin cuenta vinculada" }, ...ps.filter((p) => p.rol === "colaborador").map((p) => ({ id: p.id, nombre: (p.nombre || p.email) + " · " + p.email }))];

  const cuerpo = h("div", {},
    h("div", { class: "form-grid" },
      campo("Nombre completo", entrada(f.nombre, set("nombre")), "full"),
      campo("Edad", entrada(f.edad, set("edad"), { type: "number", min: 16, max: 80 })),
      campo("Sucursal de trabajo", entrada(f.sucursal, set("sucursal"))),
      campo("Puesto actual", entrada(f.puesto_actual, set("puesto_actual"))),
      campo("Puesto deseado", entrada(f.puesto_deseado, set("puesto_deseado"))),
      campo("Correo", entrada(f.email, set("email"), { type: "email" })),
      campo("Teléfono", entrada(f.telefono, set("telefono"))),
      campo("Fecha de inicio del programa", entrada(f.fecha_inicio, set("fecha_inicio"), { type: "date" })),
      campo("Mentor asignado", seleccion(f.mentor_id || "", mentores, (v) => { f.mentor_id = v || null; }, { disabled: !ctx.permisos.esAdmin && ctx.permisos.rol !== "mentor" })),
      campo("Cuenta de acceso del colaborador", seleccion(f.user_id || "", usuarios, (v) => { f.user_id = v || null; })),
      campo("Notas", area(f.notas, set("notas"), 3, { placeholder: "Contexto, antecedentes, acuerdos previos" }), "full")),
    h("p", { class: "nota-form", text: "La cuenta de acceso vincula a esta persona con un usuario de Supabase para que entre y registre su propio avance. Si todavía no existe, créala en Supabase y vuelve a editar este registro." }));

  modal(esNuevo ? "Registrar colaborador" : "Editar colaborador", cuerpo, [
    boton("Cancelar", cerrarModal, "ghost"),
    boton(esNuevo ? "Registrar y generar plan" : "Guardar cambios", async () => {
      if (!f.nombre.trim()) { aviso("El nombre es obligatorio", "error"); return; }
      try {
        if (esNuevo) {
          const base = ctx.estado.plantillaGlobal && ctx.estado.plantillaGlobal.semanas
            ? ctx.estado.plantillaGlobal : clonarPlantilla();
          const nuevo = await dbCol.crear(f, base, ctx.estado.perfil.id);
          cerrarModal(); aviso("Colaborador registrado con el plan completo");
          await ctx.refrescarTodo("colaboradores");
          if (nuevo && nuevo.id) ctx.elegirColaborador(nuevo.id);
        } else {
          const { id, plan, grupos, competencias, kpis, criterios, plan_visitas, etapas, riesgos, examen, juicio, creado_en, creado_por, actualizado_en, semana_actual, ...campos } = f;
          await dbCol.actualizar(existente.id, campos);
          cerrarModal(); aviso("Cambios guardados");
          ctx.refrescarTodo("colaboradores");
        }
      } catch (e) { aviso(e.message, "error"); }
    }),
  ], "ancho");
}

/* ========================================================== USUARIOS ====== */

export function vistaUsuarios(ctx) {
  const cont = h("div", { class: "vista" });
  let filtroRol = "", busqueda = "", soloInactivos = false;

  const cargar = () => {
    cont.replaceChildren(h("div", { class: "cargando-chico", text: "Cargando usuarios\u2026" }));
    dbUsuarios.listar()
      .then((us) => { ctx.estado.perfilesCache = us; pintar(us); })
      .catch((e) => cont.replaceChildren(
        panel("No se pudieron cargar los usuarios", e.message,
          boton("Reintentar", cargar, "ghost"))));
  };

  const pintar = (us) => {
    cont.replaceChildren();

    const visibles = us.filter((u) =>
      (!filtroRol || u.rol === filtroRol) &&
      (!soloInactivos || u.activo === false) &&
      (!busqueda || (`${u.nombre || ""} ${u.email || ""}`).toLowerCase().includes(busqueda.toLowerCase())));

    const porRol = (r) => us.filter((u) => u.rol === r).length;

    cont.appendChild(h("div", { class: "head-flex" },
      h("div", {},
        h("h2", { class: "titulo-vista", text: "Usuarios y roles" }),
        h("p", { class: "sub", text: "Las cuentas se comparten con las dem\u00e1s herramientas de ISEL, pero el acceso a este plan de desarrollo se concede aqu\u00ed." })),
      boton("Agregar usuario", () => formUsuario(ctx, null, cargar))));

    cont.appendChild(h("div", { class: "grid-4" },
      tarjetaConteo("Administradores", porRol("admin"), "Control total"),
      tarjetaConteo("Mentores", porRol("mentor"), "Desarrollan colaboradores"),
      tarjetaConteo("En desarrollo", porRol("colaborador"), "Registran su propio avance"),
      tarjetaConteo("Solo lectura", porRol("lector"), "Consultan sin modificar")));

    const barra = barraFiltros([
      { tipo: "texto", id: "usuarios", label: "Buscar", valor: busqueda, placeholder: "Nombre o correo",
        onChange: (v) => { busqueda = v; pintar(us); } },
      { label: "Rol", valor: filtroRol, opciones: [{ id: "", nombre: "Todos los roles" }, ...OPCIONES_ROL],
        onChange: (v) => { filtroRol = v; pintar(us); } },
      { tipo: "check", label: "Solo los suspendidos", valor: soloInactivos,
        onChange: (v) => { soloInactivos = v; pintar(us); } },
    ], `${visibles.length} de ${us.length}`,
      () => { filtroRol = ""; busqueda = ""; soloInactivos = false; pintar(us); });

    const filas = visibles.map((u) => {
      const yo = u.id === ctx.estado.perfil.id;
      return h("tr", { class: u.activo === false ? "fila-apagada" : "" },
        h("td", {},
          h("b", { text: u.nombre || "Sin nombre" }), yo ? h("span", { class: "badge badge-ok", text: "t\u00fa" }) : null,
          u.debe_cambiar ? h("div", { class: "aviso-mini", text: "Contrase\u00f1a temporal sin cambiar" }) : null),
        h("td", { class: "gris mono", text: u.email || "\u2014" }),
        h("td", {}, seleccion(u.rol, OPCIONES_ROL, async (v) => {
          try {
            await dbUsuarios.cambiarRol(u.id, v);
            aviso("Rol actualizado a " + ETIQUETA_ROL[v]);
            cargar();
          } catch (e) { aviso(e.message, "error"); cargar(); }
        }, { disabled: yo })),
        h("td", {}, (() => {
          const chk = h("input", { type: "checkbox", checked: u.activo !== false, disabled: yo });
          chk.addEventListener("change", async () => {
            try {
              await dbUsuarios.activar(u.id, chk.checked);
              aviso(chk.checked ? "Acceso reactivado" : "Acceso suspendido");
              cargar();
            } catch (e) { aviso(e.message, "error"); cargar(); }
          });
          return h("label", { class: "check-inline" }, chk, u.activo === false ? "Suspendido" : "Activo");
        })()),
        h("td", { class: "mono gris", text: u.ultimo_acceso ? fecha(u.ultimo_acceso.slice(0, 10)) : "Nunca ha entrado" }),
        h("td", { class: "acciones" },
          boton("Editar", () => formUsuario(ctx, u, cargar), "ghost"),
          boton("Contrase\u00f1a", () => formPassword(ctx, u, cargar), "ghost"),
          yo ? null : boton("Quitar acceso", () => confirmar(
            `Se le retira el acceso a ${u.nombre || u.email}. Su cuenta de ISEL sigue existiendo y conserva el acceso a las dem\u00e1s herramientas.`,
            async () => {
              try { await dbUsuarios.quitarAcceso(u.id); aviso("Acceso retirado"); cargar(); }
              catch (e) { aviso(e.message, "error"); }
            }), "ghost")));
    });

    cont.appendChild(panel(null, null, barra,
      filas.length
        ? tabla(["Usuario", "Correo", "Rol", "Estado", "\u00daltimo ingreso", ""], filas, { scroll: true })
        : vacio("Ning\u00fan usuario coincide",
            "Prueba con otro rol o limpia la b\u00fasqueda.",
            boton("Limpiar filtros", () => { filtroRol = ""; busqueda = ""; soloInactivos = false; pintar(us); }, "ghost"))));

    cont.appendChild(panel("Qu\u00e9 puede hacer cada rol", null,
      h("div", { class: "roles" },
        bloqueRol("Administrador", false, [
          "Ver y editar todo el sistema",
          "Crear usuarios y asignarles rol",
          "Suspender o retirar accesos",
          "Crear, archivar y borrar colaboradores",
          "Definir la plantilla base del programa",
        ]),
        bloqueRol("Mentor", false, [
          "Ver el avance de todos los participantes",
          "Editar el plan y las metas de sus asignados",
          "Calificar competencias y validar resultados",
          "Registrar sesiones de coaching y el dictamen",
        ]),
        bloqueRol("Colaborador en desarrollo", false, [
          "Ver \u00fanicamente su propio expediente",
          "Marcar las tareas de su plan",
          "Registrar visitas, oportunidades y cuentas",
          "Consultar sus calificaciones sin modificarlas",
        ]),
        bloqueRol("Solo lectura", false, [
          "Ver el comparativo y el expediente de cualquiera",
          "Usar todos los filtros",
          "No puede modificar absolutamente nada",
          "\u00datil para direcci\u00f3n y recursos humanos",
        ]))));
  };

  cargar();
  return cont;
}

function formUsuario(ctx, existente, alTerminar) {
  const esNuevo = !existente;
  const f = existente
    ? { email: existente.email, nombre: existente.nombre || "", rol: existente.rol, password: "", pedir_cambio: true }
    : { email: "", nombre: "", rol: "colaborador", password: generarClave(), pedir_cambio: true };

  const campoClave = entrada(f.password, (v) => { f.password = v; });
  const zonaClave = h("div", { class: "campo-full" },
    campo("Contraseña temporal", campoClave),
    h("div", { class: "acciones-fila" },
      boton("Generar otra", () => { f.password = generarClave(); campoClave.value = f.password; }, "ghost"),
      boton("Copiar", async () => {
        try { await navigator.clipboard.writeText(campoClave.value); aviso("Contraseña copiada"); }
        catch { aviso("Copíala a mano: " + campoClave.value); }
      }, "ghost")),
    h("p", { class: "nota-form", text: "Entrégasela en persona o por un medio seguro. En el plan gratuito de Supabase el envío de correos no es confiable, por eso no se manda invitación automática." }));

  const cuerpo = h("div", {},
    h("div", { class: "form-grid" },
      campo("Correo", entrada(f.email, (v) => { f.email = v; }, { type: "email", disabled: !esNuevo })),
      campo("Nombre", entrada(f.nombre, (v) => { f.nombre = v; })),
      campo("Rol", seleccion(f.rol, OPCIONES_ROL, (v) => { f.rol = v; },
        { disabled: existente && existente.id === ctx.estado.perfil.id })),
      esNuevo ? zonaClave : null,
      esNuevo ? (() => {
        const chk = h("input", { type: "checkbox", checked: f.pedir_cambio });
        chk.addEventListener("change", () => { f.pedir_cambio = chk.checked; });
        return h("label", { class: "check-inline" }, chk, "Pedirle que la cambie al entrar por primera vez");
      })() : null),
    esNuevo
      ? h("p", { class: "nota-form", text: "Si el correo ya tiene cuenta en ISEL por otra herramienta, se reutiliza esa cuenta y la persona conserva su contraseña actual." })
      : null);

  modal(esNuevo ? "Agregar usuario" : "Editar usuario", cuerpo, [
    boton("Cancelar", cerrarModal, "ghost"),
    boton(esNuevo ? "Crear usuario" : "Guardar", async () => {
      try {
        if (esNuevo) {
          const r = await dbUsuarios.crear(f);
          cerrarModal();
          aviso(r && r.mensaje ? r.mensaje : "Usuario creado");
        } else {
          if ((f.nombre || "") !== (existente.nombre || ""))
            await dbUsuarios.cambiarNombre(existente.id, f.nombre);
          if (f.rol !== existente.rol) await dbUsuarios.cambiarRol(existente.id, f.rol);
          cerrarModal(); aviso("Cambios guardados");
        }
        alTerminar();
      } catch (e) { aviso(e.message, "error"); }
    }),
  ]);
}

function formPassword(ctx, u, alTerminar) {
  const f = { password: generarClave(), pedir_cambio: true };
  const campoClave = entrada(f.password, (v) => { f.password = v; });

  modal(`Contraseña de ${u.nombre || u.email}`,
    h("div", {},
      h("p", { class: "texto", text: "Se le asigna una contraseña nueva. La anterior deja de funcionar de inmediato." }),
      campo("Contraseña temporal", campoClave),
      h("div", { class: "acciones-fila" },
        boton("Generar otra", () => { f.password = generarClave(); campoClave.value = f.password; }, "ghost"),
        boton("Copiar", async () => {
          try { await navigator.clipboard.writeText(campoClave.value); aviso("Contraseña copiada"); }
          catch { aviso("Cópiala a mano: " + campoClave.value); }
        }, "ghost")),
      (() => {
        const chk = h("input", { type: "checkbox", checked: f.pedir_cambio });
        chk.addEventListener("change", () => { f.pedir_cambio = chk.checked; });
        return h("label", { class: "check-inline sep" }, chk, "Pedirle que la cambie al entrar");
      })()),
    [boton("Cancelar", cerrarModal, "ghost"),
     boton("Asignar contraseña", async () => {
       try {
         await dbUsuarios.restablecer(u.id, campoClave.value, f.pedir_cambio);
         cerrarModal(); aviso("Contraseña asignada"); alTerminar();
       } catch (e) { aviso(e.message, "error"); }
     })]);
}

/* Contraseña temporal legible: dos palabras y un número, fácil de dictar. */
function generarClave() {
  const palabras = ["acero", "brida", "cable", "delta", "fusible", "grua", "husillo", "linea",
    "motor", "panel", "rotor", "sensor", "tablero", "valvula", "yunque", "zinc"];
  const al = (n) => Math.floor(Math.random() * n);
  return `${palabras[al(palabras.length)]}-${palabras[al(palabras.length)]}-${100 + al(900)}`;
}

/* ========================================================== PLANTILLA ===== */

export function vistaPlantilla(ctx) {
  const cont = h("div", { class: "vista" });
  const p = ctx.estado.plantillaGlobal;

  cont.appendChild(panel("Plantilla base del programa",
    "Esta es la versión que se copia a cada colaborador nuevo. Cambiarla no afecta a los colaboradores que ya están en desarrollo: el plan de cada quien es independiente y se edita desde Configurar programa.",
    h("div", { class: "grid-4" },
      resumenPlantilla("Semanas", (p.semanas || []).length),
      resumenPlantilla("Competencias", (p.competencias || []).length),
      resumenPlantilla("Indicadores", (p.kpis || []).length),
      resumenPlantilla("Criterios de graduación", (p.criterios || []).length)),
    h("p", { class: "nota-form", text: "Para modificar la plantilla, edita primero el programa de un colaborador que te sirva de modelo y después cópialo aquí como nueva base." }),
    h("div", { class: "acciones-fila" },
      boton("Copiar desde un colaborador", () => copiarDesdeColaborador(ctx)),
      boton("Descargar plantilla", () => descargar(p, "plantilla-programa.json"), "ghost"),
      boton("Cargar desde archivo", () => cargarArchivo(async (json) => {
        await dbPlantilla.guardar(json, ctx.estado.perfil.id);
        ctx.estado.plantillaGlobal = json; aviso("Plantilla actualizada"); ctx.ir("plantilla");
      }), "ghost"),
      boton("Restablecer la original", () => confirmar("Se recupera la plantilla original de ISEL. Los colaboradores ya registrados no cambian.",
        async () => {
          await dbPlantilla.restablecer(ctx.estado.perfil.id);
          ctx.estado.plantillaGlobal = clonarPlantilla(); aviso("Plantilla restablecida"); ctx.ir("plantilla");
        }), "peligro"))));

  cont.appendChild(panel("Contenido de la plantilla", null,
    tabla(["Bloque", { t: "Elementos", num: true }, "Contenido"],
      [["Meses", p.meses], ["Semanas", p.semanas], ["Grupos de competencia", p.grupos], ["Competencias", p.competencias],
      ["Indicadores", p.kpis], ["Criterios de graduación", p.criterios], ["Etapas del embudo", p.etapas],
      ["Riesgos", p.riesgos], ["Componentes del examen", p.examen]].map(([nombre, lista]) =>
        h("tr", {}, h("td", { text: nombre }), h("td", { class: "num", text: String((lista || []).length) }),
          h("td", { class: "gris", text: (lista || []).slice(0, 4).map((x) => x.nombre || x.titulo || x.riesgo || "").filter(Boolean).join(" · ") + ((lista || []).length > 4 ? "…" : "") }))))));

  return cont;
}

const resumenPlantilla = (titulo, n) =>
  h("div", { class: "tarjeta" }, h("span", { class: "tarjeta-tit", text: titulo }), h("strong", { class: "tarjeta-val", text: String(n) }));

function copiarDesdeColaborador(ctx) {
  const lista = ctx.estado.colaboradores;
  if (!lista.length) { aviso("No hay colaboradores de dónde copiar", "error"); return; }
  let elegido = lista[0].id;
  modal("Copiar programa a la plantilla base",
    h("div", {},
      h("p", { class: "texto", text: "Se tomará el plan, las competencias, los indicadores y los criterios de este colaborador y quedarán como nueva plantilla para los registros futuros." }),
      campo("Colaborador", seleccion(elegido, lista.map((c) => ({ id: c.id, nombre: c.nombre })), (v) => { elegido = v; }))),
    [boton("Cancelar", cerrarModal, "ghost"), boton("Copiar a la plantilla", async () => {
      const c = await dbCol.leer(elegido);
      const nueva = {
        ...ctx.estado.plantillaGlobal,
        semanas: c.plan, grupos: c.grupos, competencias: c.competencias, kpis: c.kpis,
        criterios: c.criterios, planVisitas: c.plan_visitas, etapas: c.etapas, riesgos: c.riesgos, examen: c.examen,
        umbrales: (c.juicio && c.juicio.umbrales) || ctx.estado.plantillaGlobal.umbrales,
      };
      await dbPlantilla.guardar(nueva, ctx.estado.perfil.id);
      ctx.estado.plantillaGlobal = nueva;
      cerrarModal(); aviso("Plantilla actualizada"); ctx.ir("plantilla");
    })]);
}

function descargar(obj, nombre) {
  const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })), download: nombre });
  a.click();
}

function cargarArchivo(alLeer) {
  const inp = h("input", { type: "file", accept: "application/json" });
  inp.addEventListener("change", () => {
    const file = inp.files[0]; if (!file) return;
    const fr = new FileReader();
    fr.onload = () => { try { alLeer(JSON.parse(fr.result)); } catch { aviso("El archivo no tiene el formato esperado", "error"); } };
    fr.readAsText(file);
  });
  inp.click();
}

/* ============================================================ MI CUENTA === */

export function vistaCuenta(ctx) {
  const p = ctx.estado.perfil;
  let nombre = p.nombre || "";
  let pass1 = "", pass2 = "";

  return h("div", { class: "vista" },
    panel("Mi cuenta", null,
      h("div", { class: "form-grid" },
        campo("Nombre", entrada(nombre, (v) => { nombre = v; })),
        campo("Correo", entrada(p.email, () => { }, { disabled: true })),
        campo("Rol", entrada(ETIQUETA_ROL[p.rol] || p.rol, () => { }, { disabled: true }))),
      h("div", { class: "acciones-fila" },
        boton("Guardar nombre", async () => {
          await perfiles.actualizar(p.id, { nombre });
          ctx.estado.perfil.nombre = nombre; aviso("Nombre actualizado"); ctx.ir("cuenta");
        }))),

    panel("Cambiar contraseña", "El cambio se aplica de inmediato. La contraseña anterior deja de funcionar.",
      h("div", { class: "form-grid" },
        campo("Nueva contraseña", entrada("", (v) => { pass1 = v; }, { type: "password" })),
        campo("Repetir contraseña", entrada("", (v) => { pass2 = v; }, { type: "password" }))),
      boton("Actualizar contraseña", async () => {
        if (pass1.length < 8) { aviso("Usa al menos 8 caracteres", "error"); return; }
        if (pass1 !== pass2) { aviso("Las contraseñas no coinciden", "error"); return; }
        try { await auth.cambiarPassword(pass1); aviso("Contraseña actualizada"); }
        catch (e) { aviso(e.message, "error"); }
      })),

    panel("Qué puedes hacer con tu rol", "El tuyo aparece resaltado. Los demás se muestran para que sepas a quién pedirle lo que tú no puedes hacer.",
      h("div", { class: "roles" },
        bloqueRol("Administrador", p.rol === "admin", [
          "Ver y editar todo el sistema", "Crear, archivar y borrar colaboradores",
          "Asignar roles y activar o desactivar usuarios", "Definir la plantilla base del programa",
          "Editar el plan y los objetivos de cualquier colaborador",
        ]),
        bloqueRol("Mentor", p.rol === "mentor", [
          "Ver el avance de todos los participantes", "Editar el plan, los objetivos y las metas de sus asignados",
          "Agregar semanas, tareas, competencias e indicadores", "Calificar competencias y validar resultados",
          "Registrar sesiones de coaching y el dictamen de graduación",
        ]),
        bloqueRol("Colaborador en desarrollo", p.rol === "colaborador", [
          "Ver únicamente su propio expediente", "Marcar las tareas de su plan conforme las completa",
          "Registrar visitas, oportunidades y cuentas", "Capturar sus resultados de indicadores",
          "Consultar sus calificaciones, pero no modificarlas",
        ]),
        bloqueRol("Solo lectura", p.rol === "lector", [
          "Ver el resumen comparativo de todos los participantes",
          "Abrir el expediente completo de cualquiera",
          "Consultar competencias, visitas, pipeline, cuentas y dictamen",
          "Usar todos los filtros y ordenar las tablas",
          "No puede modificar nada ni gestionar usuarios",
        ]))));
}

const bloqueRol = (titulo, activo, puntos) =>
  h("div", { class: cls("rol", activo && "rol-activo") },
    h("h4", {}, titulo, activo ? h("span", { class: "badge badge-ok", text: "tu rol" }) : null),
    h("ul", {}, ...puntos.map((x) => h("li", { text: x }))));
