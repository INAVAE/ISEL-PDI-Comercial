/* ===========================================================================
   Recordatorios por correo: cuándo salen y a quién le llegan.

   Solo el administrador. Antes esto vivía en el flujo de GitHub y en una
   regla fija —«todo colaborador activo»—, así que cambiar un día o sacar a
   alguien de la lista exigía tocar el repositorio.

   Dos correos distintos salen de aquí:
     · a cada persona en desarrollo, el resumen de SU plan;
     · a quien solo da seguimiento, el panorama del equipo.
   =========================================================================== */

import { recordatorios as dbRec, mensajeRecordatorios, usuarios as dbUsuarios } from "./db.js";
import { DIA, proximo, TOLERANCIA_MIN } from "./agenda.js";
import {
  h, panel, boton, tabla, seleccion, aviso, fecha, etiquetaRol, cls,
} from "./ui.js";

/* Lunes primero: es la semana de trabajo, aunque el número del domingo sea
   el 0. El valor que se guarda sigue siendo el de JavaScript. */
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
const CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const dosDigitos = (n) => String(n).padStart(2, "0");
const HORAS = Array.from({ length: 24 }, (_, i) => ({ id: String(i), nombre: dosDigitos(i) }));
/* De cinco en cinco: la hora en punto se retrasa más en GitHub y conviene
   poder huir de ella, pero elegir el minuto exacto sería fingir una
   precisión que una tarea programada no tiene. */
const MINUTOS = Array.from({ length: 12 }, (_, i) => ({ id: String(i * 5), nombre: dosDigitos(i * 5) }));

export function vistaRecordatorios(ctx) {
  const cont = h("div", { class: "vista" });

  let ajustes = null;      // lo guardado
  let borrador = null;     // lo que se está editando
  let destinos = [];
  let perfiles = [];

  const cargar = () => {
    cont.replaceChildren(h("div", { class: "cargando-chico", text: "Cargando la configuración…" }));
    Promise.all([dbRec.cargar(), dbUsuarios.listar()])
      .then(([r, us]) => {
        ajustes = r.ajustes || { activo: true, dias: [1, 4], hora: 7, minuto: 35, zona: "America/Mexico_City" };
        destinos = r.destinos;
        perfiles = us;
        borrador = { ...ajustes, dias: [...(ajustes.dias || [])] };
        pintar();
      })
      .catch((e) => cont.replaceChildren(
        panel("No se pudo cargar la configuración", mensajeRecordatorios(e),
          boton("Reintentar", cargar, "ghost"))));
  };

  /* Las dos reglas, en un solo lugar. Son distintas a propósito y es lo
     único de esta pantalla que se presta a entenderse al revés. */
  const recibeCol = (id) => {
    const d = destinos.find((x) => x.colaborador_id === id);
    return d ? d.recibe : true;          // sin renglón, recibe
  };
  const recibePerfil = (id) => {
    const d = destinos.find((x) => x.perfil_id === id);
    return d ? d.recibe : false;         // sin renglón, no recibe
  };

  const marcar = async (tipo, id, recibe, chk) => {
    chk.disabled = true;
    try {
      await dbRec.fijar(tipo, id, recibe);
      const campo = tipo === "colaborador" ? "colaborador_id" : "perfil_id";
      const previo = destinos.find((x) => x[campo] === id);
      if (previo) previo.recibe = recibe;
      else destinos.push({ [campo]: id, recibe });
      aviso(recibe ? "Empezará a recibir los correos" : "Ya no recibirá los correos");
    } catch (e) {
      chk.checked = !recibe;             // que la casilla no mienta
      aviso(mensajeRecordatorios(e), "error");
    } finally {
      chk.disabled = false;
    }
  };

  const casilla = (tipo, id, valor, etiqueta) => {
    const chk = h("input", { type: "checkbox", checked: valor });
    chk.addEventListener("change", () => marcar(tipo, id, chk.checked, chk));
    return h("label", { class: "check-inline" }, chk, etiqueta);
  };

  /* ------------------------------------------------------------ cuándo -- */

  const sucio = () => !ajustes.id
    || borrador.activo !== ajustes.activo
    || borrador.hora !== ajustes.hora
    || borrador.minuto !== ajustes.minuto
    || borrador.dias.slice().sort().join() !== (ajustes.dias || []).slice().sort().join();

  const guardar = async (btn) => {
    if (!borrador.dias.length) {
      aviso("Elige al menos un día, o apaga los recordatorios", "error");
      return;
    }
    btn.disabled = true;
    try {
      await dbRec.guardar({
        activo: borrador.activo,
        dias: borrador.dias.slice().sort(),
        hora: borrador.hora,
        minuto: borrador.minuto,
        zona: borrador.zona || "America/Mexico_City",
      }, ctx.estado.perfil.id);
      aviso("Horario guardado");
      cargar();
    } catch (e) {
      aviso(mensajeRecordatorios(e), "error");
      btn.disabled = false;
    }
  };

  const bloqueCuando = () => {
    const enc = h("input", { type: "checkbox", checked: borrador.activo !== false });
    enc.addEventListener("change", () => { borrador.activo = enc.checked; pintar(); });

    const dias = h("div", { class: "tabs dias-envio", style: "margin:4px 0 2px" },
      ...ORDEN_DIAS.map((d) => {
        const puesto = borrador.dias.includes(d);
        const b = h("button", { class: cls("tab", puesto && "activo"), type: "button", text: CORTO[d] });
        b.addEventListener("click", () => {
          borrador.dias = puesto ? borrador.dias.filter((x) => x !== d) : [...borrador.dias, d];
          pintar();
        });
        return b;
      }));

    const sig = proximo(borrador.activo === false ? null : { ...borrador, ultimo_envio: ajustes.ultimo_envio });
    const cuando = !borrador.activo
      ? "Apagados: no saldrá ningún correo."
      : !borrador.dias.length
        ? "Sin días elegidos no puede salir ninguno."
        : sucio()
          ? "Guarda para que el cambio tenga efecto."
          : sig && sig.inminente
            ? "Toca ahora: saldrá en la próxima hora."
            : sig
              ? `Próximo envío: ${DIA[sig.dow]} ${fecha(sig.fecha)} a las ${sig.hora}.`
              : "No se pudo calcular el próximo envío.";

    const btn = boton("Guardar horario", (e) => guardar(e.currentTarget || e.target));
    /* Los selectores se apagan con el interruptor, pero el interruptor y el
       botón de guardar no: hay que poder apagarlo y guardar eso. */
    const apagado = borrador.activo ? "" : "opacity:.45;pointer-events:none";

    return panel("Cuándo se envían",
      "La hora es la de Ciudad de México. GitHub ejecuta el envío y puede retrasarlo "
      + `unos minutos; si se retrasara más de ${TOLERANCIA_MIN / 60} horas, el correo se deja para el próximo día elegido.`,
      h("label", { class: "check-inline" }, enc,
        borrador.activo ? "Recordatorios encendidos" : "Recordatorios apagados"),
      h("div", { class: "campo", style: apagado },
        h("span", { text: "Días" }), dias),
      h("div", { class: "campo", style: apagado },
        h("span", { text: "Hora de salida" }),
        /* Los select llevan width:100% de serie, así que sin una caja de
           ancho fijo dos listas de dos dígitos se estiran a todo el panel. */
        h("div", { style: "display:flex;align-items:center;gap:8px" },
          h("div", { style: "width:86px" },
            seleccion(String(borrador.hora), HORAS, (v) => { borrador.hora = Number(v); pintar(); })),
          h("b", { text: ":" }),
          h("div", { style: "width:86px" },
            seleccion(String(borrador.minuto), MINUTOS, (v) => { borrador.minuto = Number(v); pintar(); })),
          h("span", { class: "sub", style: "margin:0 0 0 4px", text: "hora de Ciudad de México" }))),
      h("p", { class: "sub", style: "margin:10px 0 0", text: cuando }),
      h("p", {
        class: "sub", style: "margin:4px 0 14px",
        text: ajustes.ultimo_envio
          ? `Último envío: ${fecha(String(ajustes.ultimo_envio).slice(0, 10))}.`
          : "Todavía no ha salido ningún envío con esta configuración.",
      }),
      btn);
  };

  /* ------------------------------------------------------------- quién -- */

  const bloqueColaboradores = () => {
    const activos = (ctx.estado.colaboradores || []).filter((c) => c.estado === "activo");

    if (!activos.length)
      return panel("Quién recibe el resumen de su plan",
        "No hay nadie en desarrollo ahora mismo.");

    const filas = activos.map((c) => {
      const cuenta = perfiles.find((p) => p.id === c.user_id);
      const correo = (cuenta && cuenta.email) || c.email || null;
      /* La fila no se apaga aunque falte el correo: la casilla sigue siendo
         útil —se deja decidido para cuando se le registre la dirección— y
         atenuarla la haría parecer inservible. El aviso ya lo explica. */
      return h("tr", {},
        h("td", {}, h("b", { text: c.nombre }),
          correo ? null : h("div", { class: "aviso-mini", text: "Sin correo: no le puede llegar nada" })),
        h("td", { class: "gris mono", text: correo || "—" }),
        h("td", {}, casilla("colaborador", c.id, recibeCol(c.id), "Recibe")));
    });

    return panel("Quién recibe el resumen de su plan",
      "Le llega lo suyo: lo atrasado, lo de esta semana y lo que lleva hecho. "
      + "Quien se dé de alta después queda incluido sin que haya que hacer nada.",
      tabla(["Persona", "Correo", "Recordatorios"], filas));
  };

  const bloqueObservadores = () => {
    const cuentas = perfiles.filter((p) => p.activo !== false);

    const filas = cuentas.map((p) => h("tr", {},
      h("td", {}, h("b", { text: p.nombre || "Sin nombre" })),
      h("td", {}, etiquetaRol(p.rol)),
      h("td", { class: "gris mono", text: p.email || "—" }),
      h("td", {}, p.email
        ? casilla("perfil", p.id, recibePerfil(p.id), "Recibe")
        : h("span", { class: "gris", text: "Sin correo" }))));

    return panel("Quién recibe el panorama del equipo",
      "Un correo informativo con el estado de todas las personas en desarrollo, "
      + "para quien da seguimiento sin llevar un plan propio. Nadie lo recibe hasta que se marque aquí. "
      + "Si además lleva un plan, recibirá los dos correos.",
      tabla(["Persona", "Rol", "Correo", "Panorama"], filas));
  };

  const pintar = () => {
    cont.replaceChildren(
      h("div", { class: "head-flex" },
        h("div", {},
          h("h2", { class: "titulo-vista", text: "Recordatorios por correo" }),
          h("p", { class: "sub", text: "Los correos salen automáticamente. Aquí se decide qué días, a qué hora y a quién." }))),
      bloqueCuando(),
      bloqueColaboradores(),
      bloqueObservadores());
  };

  cargar();
  return cont;
}
