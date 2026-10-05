import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { clonarPlantilla } from "./plantilla.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Envoltura mínima: lanza el error de Supabase con un mensaje legible. */
const ok = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

/* -------------------------------------------------------------- SESIÓN --- */

export const auth = {
  async entrar(email, password) {
    return ok(await sb.auth.signInWithPassword({ email, password }));
  },
  async salir() {
    await sb.auth.signOut();
  },
  async sesion() {
    const { data } = await sb.auth.getSession();
    return data.session;
  },
  async recuperar(email) {
    return ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href }));
  },
  async cambiarPassword(password) {
    return ok(await sb.auth.updateUser({ password }));
  },
  alCambiar(fn) {
    sb.auth.onAuthStateChange((_evt, session) => fn(session));
  },
};

export async function miPerfil() {
  const s = await auth.sesion();
  if (!s) return null;
  const filas = ok(await sb.from("pdc_profiles").select("*").eq("id", s.user.id).limit(1));
  if (filas && filas.length) return filas[0];
  // El disparador de alta pudo no haber corrido todavía
  return { id: s.user.id, email: s.user.email, nombre: s.user.email, rol: "colaborador", activo: true };
}

export const perfiles = {
  listar: async () => ok(await sb.from("pdc_profiles").select("*").order("nombre")),
  actualizar: async (id, campos) => ok(await sb.from("pdc_profiles").update(campos).eq("id", id).select()),
};

/* -------------------------------------------------------- PLANTILLA ------ */

export const plantilla = {
  async leer() {
    const filas = ok(await sb.from("pdc_plantilla").select("contenido").eq("id", 1));
    const c = filas && filas[0] && filas[0].contenido;
    return c && c.semanas ? c : clonarPlantilla();
  },
  async guardar(contenido, autor) {
    return ok(await sb.from("pdc_plantilla")
      .upsert({ id: 1, contenido, actualizado_en: new Date().toISOString(), actualizado_por: autor })
      .select());
  },
  async restablecer(autor) {
    return plantilla.guardar(clonarPlantilla(), autor);
  },
};

/* ---------------------------------------------------- COLABORADORES ------ */

const CAMPOS_PROGRAMA = ["plan", "grupos", "competencias", "kpis", "criterios", "planVisitas", "etapas", "riesgos", "examen", "juicio"];

export const colaboradores = {
  listar: async () => ok(await sb.from("pdc_colaboradores").select("*").order("creado_en", { ascending: false })),

  leer: async (id) => {
    const filas = ok(await sb.from("pdc_colaboradores").select("*").eq("id", id));
    return filas[0] || null;
  },

  async crear(datos, base, autor) {
    const fila = {
      ...datos,
      plan: base.semanas,
      grupos: base.grupos,
      competencias: base.competencias,
      kpis: base.kpis,
      criterios: base.criterios,
      plan_visitas: base.planVisitas,
      etapas: base.etapas,
      riesgos: base.riesgos,
      examen: base.examen,
      juicio: {
        rolePlays: 0, evalGerente: 0, notas: "",
        umbrales: base.umbrales, meses: base.meses, plan90: base.plan90,
        roles: base.roles, cadencia: base.cadencia, calificaciones: {},
      },
      creado_por: autor,
    };
    return ok(await sb.from("pdc_colaboradores").insert(fila).select())[0];
  },

  actualizar: async (id, campos) => ok(await sb.from("pdc_colaboradores")
    .update({ ...campos, actualizado_en: new Date().toISOString() }).eq("id", id).select()),

  borrar: async (id) => ok(await sb.from("pdc_colaboradores").delete().eq("id", id)),
};

/* --------------------------------------------------- EXPEDIENTE ---------- */
/* Carga en paralelo todo lo que necesita la vista de un colaborador. */

export async function cargarExpediente(colaboradorId) {
  const q = (t) => sb.from(t).select("*").eq("colaborador_id", colaboradorId);
  const [avance, kpis, evals, visitas, opps, cuentas, coaching] = await Promise.all([
    q("pdc_plan_avance"), q("pdc_kpi_resultados"), q("pdc_evaluaciones"),
    q("pdc_visitas"), q("pdc_oportunidades"), q("pdc_cuentas"), q("pdc_coaching"),
  ]);
  return {
    avance: ok(avance), kpis: ok(kpis), evals: ok(evals),
    visitas: ok(visitas), opps: ok(opps), cuentas: ok(cuentas), coaching: ok(coaching),
  };
}

/* Versión ligera para el resumen comparativo de todos los colaboradores. */
export async function cargarResumenGlobal(ids) {
  if (!ids.length) return { avance: [], evals: [], visitas: [], opps: [], cuentas: [] };
  const q = (t, cols) => sb.from(t).select(cols).in("colaborador_id", ids);
  const [avance, evals, visitas, opps, cuentas] = await Promise.all([
    q("pdc_plan_avance", "colaborador_id,tarea_id,hecho"),
    q("pdc_evaluaciones", "colaborador_id,competencia_id,corte,nivel"),
    q("pdc_visitas", "colaborador_id,tipo,mes,cuenta_nueva"),
    q("pdc_oportunidades", "colaborador_id,valor,etapa,origen"),
    q("pdc_cuentas", "colaborador_id,aprobado,madurez"),
  ]);
  return { avance: ok(avance), evals: ok(evals), visitas: ok(visitas), opps: ok(opps), cuentas: ok(cuentas) };
}

/* ------------------------------------------------- REGISTROS SUELTOS ----- */

const tabla = (nombre) => ({
  guardar: async (fila) => {
    if (fila.id) {
      const { id, ...resto } = fila;
      return ok(await sb.from(nombre).update(resto).eq("id", id).select())[0];
    }
    return ok(await sb.from(nombre).insert(fila).select())[0];
  },
  borrar: async (id) => ok(await sb.from(nombre).delete().eq("id", id)),
});

export const visitas = tabla("pdc_visitas");
export const oportunidades = tabla("pdc_oportunidades");
export const cuentas = tabla("pdc_cuentas");
export const coaching = tabla("pdc_coaching");

export const avance = {
  marcar: async (colaborador_id, semana_id, tarea_id, hecho) =>
    ok(await sb.from("pdc_plan_avance").upsert(
      { colaborador_id, semana_id, tarea_id, hecho, actualizado_en: new Date().toISOString() },
      { onConflict: "colaborador_id,tarea_id" }
    ).select())[0],

  anotar: async (colaborador_id, semana_id, tarea_id, campos) =>
    ok(await sb.from("pdc_plan_avance").upsert(
      { colaborador_id, semana_id, tarea_id, ...campos, actualizado_en: new Date().toISOString() },
      { onConflict: "colaborador_id,tarea_id" }
    ).select())[0],
};

export const kpiResultados = {
  guardar: async (colaborador_id, kpi_id, mes, valor) =>
    ok(await sb.from("pdc_kpi_resultados").upsert(
      { colaborador_id, kpi_id, mes, valor, actualizado_en: new Date().toISOString() },
      { onConflict: "colaborador_id,kpi_id,mes" }
    ).select())[0],

  validar: async (colaborador_id, kpi_id, mes, validado, validado_por) =>
    ok(await sb.from("pdc_kpi_resultados").upsert(
      { colaborador_id, kpi_id, mes, validado, validado_por, actualizado_en: new Date().toISOString() },
      { onConflict: "colaborador_id,kpi_id,mes" }
    ).select())[0],
};

export const evaluaciones = {
  guardar: async (colaborador_id, competencia_id, corte, nivel, evaluador_id, comentario) =>
    ok(await sb.from("pdc_evaluaciones").upsert(
      { colaborador_id, competencia_id, corte, nivel, evaluador_id, comentario, fecha: new Date().toISOString() },
      { onConflict: "colaborador_id,competencia_id,corte" }
    ).select())[0],
};
