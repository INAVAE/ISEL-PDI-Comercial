// =========================================================================
//  pdc-usuarios · Gestión de usuarios del Plan de Desarrollo Comercial ISEL
//
//  Corre en el servidor de Supabase, no en el navegador, porque necesita la
//  llave secreta del proyecto. Solo obedece a un administrador activo.
//
//  Acciones: listar | crear | rol | activo | password | datos | quitar
//
//  Desplegada en el proyecto ISEL - PDI. Para actualizarla:
//    supabase functions deploy pdc-usuarios
// =========================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const falla = (message: string, status = 400) => json({ message }, status);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["admin", "mentor", "colaborador", "lector"];
const normalizarRol = (r: unknown) => (ROLES.includes(String(r)) ? String(r) : "lector");

// deno-lint-ignore no-explicit-any
export async function manejar(
  req: Request,
  adm: any,
  verificarToken: (t: string) => Promise<{ id: string; email: string } | null>,
) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return falla("Método no permitido", 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const yo = token ? await verificarToken(token) : null;
  if (!yo) return falla("Tu sesión expiró. Vuelve a entrar.", 401);

  const { data: mio } = await adm.from("pdc_profiles")
    .select("rol, activo").eq("id", yo.id).maybeSingle();
  if (!mio || !mio.activo || mio.rol !== "admin")
    return falla("Solo un administrador puede gestionar usuarios.", 403);

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return falla("Solicitud inválida."); }
  const accion = String(b.accion || "");
  const ACCIONES = ["listar", "crear", "rol", "activo", "password", "datos", "quitar"];
  if (!ACCIONES.includes(accion)) return falla("Acción desconocida.");

  const contarAdmins = async () => {
    const { count } = await adm.from("pdc_profiles")
      .select("id", { count: "exact", head: true }).eq("rol", "admin").eq("activo", true);
    return count || 0;
  };
  const protegerUltimoAdmin = async (uid: string) => {
    const { data: x } = await adm.from("pdc_profiles")
      .select("rol, activo").eq("id", uid).maybeSingle();
    if (x && x.rol === "admin" && x.activo && (await contarAdmins()) <= 1)
      return falla("Debe quedar al menos un administrador activo.");
    return null;
  };

  // ---------------------------------------------------------------- listar --
  if (accion === "listar") {
    const { data: filas, error } = await adm.from("pdc_profiles").select("*").order("creado_en");
    if (error) return falla(error.message, 500);
    const usuarios = [];
    for (const f of filas || []) {
      const { data: u } = await adm.auth.admin.getUserById(f.id);
      usuarios.push({ ...f, ultimo_acceso: u?.user?.last_sign_in_at || null });
    }
    return json({ usuarios });
  }

  // ----------------------------------------------------------------- crear --
  if (accion === "crear") {
    const email = String(b.email || "").trim().toLowerCase();
    const nombre = String(b.nombre || "").trim();
    const rol = normalizarRol(b.rol);
    const password = String(b.password || "");
    const pedirCambio = b.pedir_cambio !== false;
    if (!EMAIL.test(email)) return falla("Escribe un correo válido.");

    // La cuenta puede existir ya por la Junta Mensual: en ese caso se reutiliza
    // y conserva su contraseña actual.
    let existente: { id: string } | null = null;
    for (let pagina = 1; pagina < 50 && !existente; pagina++) {
      const { data, error } = await adm.auth.admin.listUsers({ page: pagina, perPage: 200 });
      if (error) return falla(error.message, 500);
      existente = (data.users || [])
        .find((u: { email?: string }) => (u.email || "").toLowerCase() === email) || null;
      if (!data.users || data.users.length < 200) break;
    }

    let uid: string, nuevo = false;
    if (existente) {
      uid = existente.id;
    } else {
      if (password.length < 8) return falla("La contraseña temporal debe tener al menos 8 caracteres.");
      const { data, error } = await adm.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { nombre },
      });
      if (error) return falla(error.message);
      uid = data.user.id; nuevo = true;
    }

    const { data: yaTiene } = await adm.from("pdc_profiles").select("id").eq("id", uid).maybeSingle();
    const { error } = await adm.from("pdc_profiles").upsert({
      id: uid, email, nombre: nombre || email.split("@")[0], rol, activo: true,
      debe_cambiar: nuevo ? pedirCambio : false,
    }, { onConflict: "id" });
    if (error) return falla(error.message, 500);

    return json({
      ok: true, nuevo,
      mensaje: nuevo
        ? "Usuario creado. Entrégale la contraseña temporal."
        : yaTiene
          ? "Ese correo ya tenía acceso: se actualizaron sus datos."
          : "El correo ya tenía cuenta en ISEL (por ejemplo de la Junta Mensual). Se le dio acceso a esta herramienta y conserva su contraseña actual.",
    });
  }

  const uid = String(b.user_id || "");
  if (!uid) return falla("Falta el usuario.");

  // ------------------------------------------------------------------- rol --
  if (accion === "rol") {
    const rol = normalizarRol(b.rol);
    if (uid === yo.id && rol !== "admin") return falla("No puedes quitarte a ti mismo el rol de administrador.");
    if (rol !== "admin") { const p = await protegerUltimoAdmin(uid); if (p) return p; }
    const { error } = await adm.from("pdc_profiles").update({ rol }).eq("id", uid);
    return error ? falla(error.message, 500) : json({ ok: true });
  }

  // ---------------------------------------------------------------- activo --
  if (accion === "activo") {
    const activo = !!b.activo;
    if (uid === yo.id && !activo) return falla("No puedes desactivarte a ti mismo.");
    if (!activo) { const p = await protegerUltimoAdmin(uid); if (p) return p; }
    const { error } = await adm.from("pdc_profiles").update({ activo }).eq("id", uid);
    return error ? falla(error.message, 500) : json({ ok: true });
  }

  // -------------------------------------------------------------- password --
  if (accion === "password") {
    const password = String(b.password || "");
    if (password.length < 8) return falla("La contraseña temporal debe tener al menos 8 caracteres.");
    const { error } = await adm.auth.admin.updateUserById(uid, { password });
    if (error) return falla(error.message);
    const { error: e2 } = await adm.from("pdc_profiles")
      .update({ debe_cambiar: b.pedir_cambio !== false }).eq("id", uid);
    return e2 ? falla(e2.message, 500) : json({ ok: true });
  }

  // ----------------------------------------------------------------- datos --
  if (accion === "datos") {
    const nombre = String(b.nombre || "").trim();
    if (!nombre) return falla("El nombre no puede quedar vacío.");
    const { error } = await adm.from("pdc_profiles").update({ nombre }).eq("id", uid);
    return error ? falla(error.message, 500) : json({ ok: true });
  }

  // ---------------------------------------------------------------- quitar --
  if (accion === "quitar") {
    if (uid === yo.id) return falla("No puedes quitarte el acceso a ti mismo.");
    const p = await protegerUltimoAdmin(uid); if (p) return p;
    // Si la persona está vinculada a un expediente, primero hay que desvincularla
    const { count } = await adm.from("pdc_colaboradores")
      .select("id", { count: "exact", head: true }).eq("user_id", uid);
    if (count && count > 0)
      return falla("Esta persona está vinculada a un expediente de colaborador. Quita el vínculo en Colaboradores antes de retirarle el acceso.");
    // Solo se retira el acceso a esta herramienta; la cuenta sigue existiendo
    // porque la comparte con la Junta Mensual.
    const { error } = await adm.from("pdc_profiles").delete().eq("id", uid);
    return error ? falla(error.message, 500) : json({ ok: true });
  }

  return falla("Acción desconocida.");
}

if (typeof Deno !== "undefined" && Deno.serve) {
  const URL_ = Deno.env.get("SUPABASE_URL")!;
  let secreta = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  try {
    const nuevas = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (nuevas) secreta = JSON.parse(nuevas)["default"] || secreta;
  } catch { /* se conserva la llave heredada */ }

  const adm = createClient(URL_, secreta, { auth: { persistSession: false, autoRefreshToken: false } });
  Deno.serve((req) =>
    manejar(req, adm, async (t) => {
      const { data, error } = await adm.auth.getUser(t);
      return error || !data?.user ? null : { id: data.user.id, email: data.user.email || "" };
    }).catch((e) => falla(String(e?.message || e), 500))
  );
}
