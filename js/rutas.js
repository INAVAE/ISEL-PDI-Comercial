/* ===========================================================================
   Construcción de las rutas del depósito de evidencias.

   Vive aparte de db.js para poder probarse sin levantar el cliente de
   Supabase, y para que el simulador de las pruebas use exactamente la misma
   función que la aplicación en lugar de una copia que se desincroniza.
   =========================================================================== */

/* Un nombre de archivo puede traer acentos, espacios, comillas y cualquier
   cosa; una clave de depósito viaja por URLs firmadas y conviene que no
   lleve nada que haya que escapar. El nombre original se conserva aparte,
   que es el que la persona reconoce. */
export const rutaSegura = (texto) =>
  (texto || "archivo")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80) || "archivo";

/* <colaborador_id>/<tarea>/<momento>-<nombre>

   La primera carpeta es el id del colaborador a propósito: así las políticas
   del depósito reusan los mismos permisos que el resto de la herramienta.
   El id de tarea trae dos puntos ("S5:t1"), por eso también se sanea. */
export const rutaEvidencia = (colaboradorId, tareaId, nombreArchivo, momento = Date.now()) =>
  `${colaboradorId}/${rutaSegura(tareaId)}/${momento}-${rutaSegura(nombreArchivo)}`;
