/* ===========================================================================
   Vistas de gestión: resumen comparativo, alta de colaboradores,
   usuarios y roles, plantilla base y cuenta propia.
   =========================================================================== */

import {
  colaboradores as dbCol, cargarResumenGlobal, perfiles, plantilla as dbPlantilla, auth,
} from "./db.js";
import { resumenColaborador } from "./metricas.js";
import { clonarPlantilla } from "./plantilla.js";
import {
  h, panel, tabla, boton, campo, entrada, area, seleccion, modal, cerrarModal, aviso, confirmar,
  lampara, barra, dinero, numero, pct, fecha, vacio, radar, barras, barrasH, lineas, color, cls, tarjeta,
} from "./ui.js";

const ETIQUETA_ROL = { admin: "Administrador", mentor: "Mentor", colaborador: "Colaborador" };

/* ======================================================= RESUMEN GENERAL == */

export function vistaResumen(ctx) {
  const cont = h("div", { class: "vista" });
  const activos = ctx.estado.colaboradores.filter((c) => c.estado === "activo");
  const mios = ctx.permisos.esAdmin ? activos : activos.filter((c) => c.mentor_id === ctx.estado.perfil.id);
  const lista = mios.length ? mios : activos;

  if (!lista.length) {
    cont.appendChild(panel("Todavía no hay colaboradores en desarrollo", null,
      vacio("Sin participantes activos",
        "Registra al primer colaborador para empezar a medir su avance.",
        boton("Registrar colaborador", () => ctx.ir("colaboradores")))));
    return cont;
  }

  cont.appendChild(h("div", { class: "cargando-chico", text: "Calculando el comparativo…" }));

  cargarResumenGlobal(lista.map((c) => c.id)).then((datos) => {
    cont.replaceChildren();
    const r = lista.map((c) => resumenColaborador(c, datos)).sort((a, b) => b.score - a.score);

    const prom = (f) => r.reduce((a, x) => a + f(x), 0) / r.length;

    cont.appendChild(h("div", { class: "grid-4" },
      tarjeta("Colaboradores activos", r.length, `${ctx.estado.colaboradores.filter((c) => c.estado === "graduado").length} ya graduados`, 100),
      tarjeta("Scorecard promedio", prom((x) => x.score).toFixed(2), "Referencia de graduación: 4.00", pct(prom((x) => x.score), 4)),
      tarjeta("Avance promedio del plan", Math.round(prom((x) => x.avance)) + "%", "Tareas completadas del programa", Math.round(prom((x) => x.avance))),
      tarjeta("Pipeline del grupo", dinero(r.reduce((a, x) => a + x.pipeline, 0)), `${r.reduce((a, x) => a + x.opps, 0)} oportunidades abiertas`, 100)));

    /* Tabla comparativa */
    cont.appendChild(panel("Comparativo de participantes",
      "Ordenado por scorecard. Da clic en un renglón para abrir el expediente completo de esa persona.",
      tabla(
        ["Colaborador", "Sucursal", { t: "Avance", num: true }, { t: "Scorecard", num: true }, { t: "Visitas", num: true },
          { t: "Solo", num: true }, { t: "Oportunidades", num: true }, { t: "Pipeline", num: true }, { t: "Ventas", num: true },
          { t: "Cuentas", num: true }, { t: "Planes", num: true }],
        r.map((x) => h("tr", { class: "fila-click", onclick: () => ctx.elegirColaborador(x.col.id).then(() => ctx.ir("panel")) },
          h("td", {}, h("b", { text: x.col.nombre }), h("br"), h("span", { class: "gris", text: x.col.puesto_actual || "" })),
          h("td", { text: x.col.sucursal || "—" }),
          h("td", { class: "num" }, String(x.avance) + "%", barra(x.avance, 100, x.avance >= 80 ? "var(--run)" : "var(--signal)")),
          h("td", { class: "num" }, h("b", { class: x.score >= 4 ? "verde-fuerte" : "", text: x.score ? x.score.toFixed(2) : "—" })),
          h("td", { class: "num", text: String(x.visitas) }),
          h("td", { class: "num", text: String(x.visitasSolo) }),
          h("td", { class: "num", text: String(x.opps) }),
          h("td", { class: "num mono", text: dinero(x.pipeline) }),
          h("td", { class: "num mono", text: dinero(x.ventas) }),
          h("td", { class: "num", text: String(x.cuentas) }),
          h("td", { class: "num", text: String(x.planes) }))),
        { scroll: true })));

    /* Gráficas comparativas */
    const nombres = r.map((x) => x.col.nombre.split(" ")[0]);
    cont.appendChild(h("div", { class: "grid-2" },
      panel("Scorecard por participante", "Nivel promedio ponderado en el último corte evaluado.",
        barrasH(r.map((x) => x.col.nombre), r.map((x) => Number(x.score.toFixed(2))),
          { colores: r.map((x) => (x.score >= 4 ? "var(--run)" : x.score >= 3 ? "var(--signal)" : "var(--fault)")), formato: (v) => v.toFixed(2) })),
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

    /* Evolución y radar comparativo */
    const cortes = ["Inicial", "Mes 1", "Mes 2", "Mes 3", "Mes 4", "Mes 5"];
    cont.appendChild(h("div", { class: "grid-2" },
      panel("Evolución del scorecard", "Una línea por participante. La línea roja marca el nivel de graduación.",
        lineas(cortes, r.slice(0, 8).map((x, i) => ({ nombre: x.col.nombre.split(" ")[0], color: color(i), valores: x.serieScore })),
          { max: 5, referencia: 4, refTexto: "graduación", alto: 280 })),
      panel("Perfil de competencias", "Promedio por grupo en el último corte de cada participante.",
        radar(
          (r[0].grupos || []).map((g) => g.nombre.replace("Competencias ", "")),
          r.slice(0, 5).map((x, i) => ({
            nombre: x.col.nombre.split(" ")[0], color: color(i),
            valores: (x.grupos || []).map((g) => Number(x.promedioGrupo(g.id).toFixed(2))),
          }))))));

    /* Quién necesita atención */
    const atencion = r.filter((x) => x.score > 0 && x.score < 3.5).concat(r.filter((x) => x.avance < 40 && x.score === 0));
    cont.appendChild(panel("Dónde poner la atención esta semana", null,
      h("ul", { class: "alertas" },
        ...(atencion.length
          ? atencion.map((x) => h("li", {}, lampara("signal",
            `${x.col.nombre}: scorecard ${x.score ? x.score.toFixed(2) : "sin evaluar"} y ${x.avance}% del plan completado`)))
          : [h("li", {}, lampara("run", "Todos los participantes van dentro de parámetros."))]),
        ...r.filter((x) => x.visitas > 0 && x.visitasSolo === 0 && x.avance > 50)
          .map((x) => h("li", {}, lampara("fault", `${x.col.nombre} aún no lidera ninguna visita solo`))))));
  }).catch((e) => {
    cont.replaceChildren(panel("No se pudo calcular el comparativo", e.message));
  });

  return cont;
}

/* ====================================================== COLABORADORES ===== */

export function vistaColaboradores(ctx) {
  const cont = h("div", { class: "vista" });
  const todos = ctx.estado.colaboradores;
  const puedeCrear = ctx.permisos.esAdmin || ctx.permisos.rol === "mentor";

  const grupos = [
    { id: "activo", nombre: "En desarrollo" },
    { id: "graduado", nombre: "Graduados" },
    { id: "archivado", nombre: "Archivados" },
  ];

  cont.appendChild(h("div", { class: "head-flex" },
    h("div", {}, h("h2", { class: "titulo-vista", text: "Colaboradores en desarrollo" }),
      h("p", { class: "sub", text: "Cada colaborador tiene su propio plan de trabajo, sus objetivos y su expediente de evidencia." })),
    puedeCrear ? boton("Registrar colaborador", () => formColaborador(ctx, null)) : null));

  grupos.forEach((g) => {
    const lista = todos.filter((c) => c.estado === g.id);
    if (!lista.length && g.id !== "activo") return;
    cont.appendChild(panel(g.nombre, null,
      lista.length
        ? tabla(["Nombre", "Puesto actual → objetivo", "Contacto", "Sucursal", "Mentor", "Inicio", ""],
          lista.map((c) => filaColaborador(ctx, c)), { scroll: true })
        : vacio("Sin colaboradores en esta lista",
          "Registra a la persona que vas a desarrollar: nombre, puesto actual, puesto objetivo y sucursal.",
          puedeCrear ? boton("Registrar colaborador", () => formColaborador(ctx, null)) : null)));
  });

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
  cont.appendChild(h("div", { class: "cargando-chico", text: "Cargando usuarios…" }));

  perfiles.listar().then((ps) => {
    ctx.estado.perfilesCache = ps;
    cont.replaceChildren();
    cont.appendChild(panel("Usuarios y roles",
      "Las credenciales se crean en Supabase, en Authentication → Users. Aquí defines qué puede hacer cada quien.",
      tabla(["Nombre", "Correo", "Rol", "Estado", "Alta"],
        ps.map((p) => h("tr", {},
          h("td", {}, entrada(p.nombre || "", async (v) => {
            await perfiles.actualizar(p.id, { nombre: v }); aviso("Nombre actualizado");
          })),
          h("td", { class: "gris mono", text: p.email || "—" }),
          h("td", {}, seleccion(p.rol, [
            { id: "colaborador", nombre: "Colaborador en desarrollo" },
            { id: "mentor", nombre: "Mentor" },
            { id: "admin", nombre: "Administrador" },
          ], async (v) => {
            await perfiles.actualizar(p.id, { rol: v });
            aviso("Rol actualizado a " + ETIQUETA_ROL[v]);
            if (p.id === ctx.estado.perfil.id) location.reload();
          }, { disabled: p.id === ctx.estado.perfil.id })),
          h("td", {}, (() => {
            const chk = h("input", { type: "checkbox", checked: p.activo !== false, disabled: p.id === ctx.estado.perfil.id });
            chk.addEventListener("change", async () => {
              await perfiles.actualizar(p.id, { activo: chk.checked });
              aviso(chk.checked ? "Usuario activado" : "Usuario desactivado");
            });
            return h("label", { class: "check-inline" }, chk, chk.checked ? "Activo" : "Inactivo");
          })()),
          h("td", { class: "mono gris", text: p.creado_en ? fecha(p.creado_en.slice(0, 10)) : "—" }))))));

    cont.appendChild(panel("Cómo dar de alta a alguien", null,
      h("ol", { class: "pasos" },
        h("li", { text: "Entra a tu proyecto de Supabase, sección Authentication → Users → Add user, y crea el correo y la contraseña." }),
        h("li", { text: "Regresa aquí: el usuario aparece en la lista con el rol de colaborador." }),
        h("li", { text: "Cámbiale el rol si es mentor o administrador." }),
        h("li", { text: "Si es un colaborador en desarrollo, ve a Colaboradores, edita su ficha y vincúlala con su cuenta de acceso." }))));
  }).catch((e) => cont.replaceChildren(panel("No se pudieron cargar los usuarios", e.message)));

  return cont;
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

    panel("Cambiar contraseña", "Se aplica de inmediato a tu usuario de Supabase.",
      h("div", { class: "form-grid" },
        campo("Nueva contraseña", entrada("", (v) => { pass1 = v; }, { type: "password" })),
        campo("Repetir contraseña", entrada("", (v) => { pass2 = v; }, { type: "password" }))),
      boton("Actualizar contraseña", async () => {
        if (pass1.length < 8) { aviso("Usa al menos 8 caracteres", "error"); return; }
        if (pass1 !== pass2) { aviso("Las contraseñas no coinciden", "error"); return; }
        try { await auth.cambiarPassword(pass1); aviso("Contraseña actualizada"); }
        catch (e) { aviso(e.message, "error"); }
      })),

    panel("Qué puedes hacer con tu rol", null,
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
        ]))));
}

const bloqueRol = (titulo, activo, puntos) =>
  h("div", { class: cls("rol", activo && "rol-activo") },
    h("h4", {}, titulo, activo ? h("span", { class: "badge badge-ok", text: "tu rol" }) : null),
    h("ul", {}, ...puntos.map((x) => h("li", { text: x }))));
