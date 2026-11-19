/* Piezas de interfaz compartidas entre la lista de órdenes (ordenes.php) y el detalle de una orden (orden.php):
   etapa, anticipo, cancelar, WhatsApp, botones de piezas y cargos. Requiere piezas_ui.js. */
"use strict"

const OrdenUI = (() => {
  const ETAPAS = ["recibido", "reparacion", "listo"]

  /** Total estimado a cobrar al cliente (sin descuento). */
  const totalOrden = (o) => calcularCobro({ tipo: o.tipo, piezas: o.piezas, cargos: o.cargos, deducible: o.deducible }).total
  const piezasActivas = (o) => o.piezas.filter((p) => p.estado !== "devuelta").length
  const faltantes = (o) => o.piezas.filter((p) => p.estado === "pendiente" || p.estado === "recibida")

  /** Botones de cambio de estado permitidos (igual que TRANSICIONES_PIEZA en el servidor). */
  const ACCIONES_PIEZA = {
    pendiente: [["recibida", "Recibida"], ["instalada", "Instalada"], ["devolver", "Devolver"]],
    recibida: [["instalada", "Instalada"], ["devolver", "Devolver"], ["pendiente", "No llegó"]],
    instalada: [["recibida", "Deshacer"]],
    devuelta: [],
  }

  const estadoBadge = (estado) =>
    `<span class="estado estado-${esc(estado)}"><i></i>${esc(ESTADO_LABEL[estado] || estado)}</span>`

  /** Selector de etapa (solo órdenes pendientes). */
  function etapaCtrl(o) {
    if (o.estado !== "pendiente") return estadoBadge(o.estado)
    return `<div class="etapas" role="group" aria-label="Etapa de la orden #${pad4(o.id_orden)}">${ETAPAS.map((e, i) => `
      <button type="button" class="etapa etapa-${e}${o.etapa === e ? " on" : ""}${ETAPAS.indexOf(o.etapa) > i ? " past" : ""}"
        data-etapa="${e}" data-orden="${o.id_orden}" title="${ETAPA_LABEL[e]}">${["Recibido", "Reparación", "Listo"][i]}</button>`).join("")}</div>`
  }

  function mensajeWhatsApp(o, taller) {
    const total = o.total_venta ?? totalOrden(o)
    const base = `Hola ${o.cliente.split(" ")[0]}, le escribimos de ${taller.nombre_taller || "el taller"}.`
    if (o.estado === "completado") return `${base} Gracias por su preferencia. Su orden #${pad4(o.id_orden)} (${o.vehiculo}, placas ${o.placas}) quedó pagada por ${fmtMXN(total)}.`
    if (o.etapa === "listo") return `${base} Su vehículo ${o.vehiculo} con placas ${o.placas} ya está listo para entregar. ${o.tipo === "seguro" ? "Deducible a pagar" : "Total estimado"}: ${fmtMXN(totalOrden(o))}${o.anticipo > 0 ? ` (anticipo recibido: ${fmtMXN(o.anticipo)})` : ""}.`
    return `${base} Le informamos que su vehículo ${o.vehiculo} con placas ${o.placas} se encuentra: ${ETAPA_LABEL[o.etapa]}. Orden #${pad4(o.id_orden)}.`
  }

  /** Botones de acción de la orden (cobrar, anticipo, WhatsApp, cancelar / recibo). */
  function acciones(o, taller) {
    const wa = whatsappUrl(o.telefono, mensajeWhatsApp(o, taller))
    const btnWa = wa
      ? `<a class="act-btn act-wa" href="${esc(wa)}" target="_blank" rel="noopener" title="Abrir WhatsApp con el mensaje listo">${sym("note", 13)}WhatsApp</a>`
      : ""
    if (o.estado === "pendiente") {
      const f = faltantes(o).length
      // no se bloquea: si faltan piezas, el botón avisa y lleva a ellas
      const cobrar = f > 0
        ? `<button type="button" class="act-btn act-gray" data-faltan="${o.id_orden}" title="Marca las piezas como instaladas para poder cobrar">${sym("wrench", 13)}Faltan ${f} pieza${plural(f)}</button>`
        : `<a class="act-btn act-del" href="cobrar.php?id=${o.id_orden}">${ICON.money}Cobrar</a>`
      return `${cobrar}
        <button type="button" class="act-btn act-edit" data-anticipo="${o.id_orden}">${sym("cash", 13)}Anticipo</button>
        ${btnWa}
        <button type="button" class="act-btn act-gray" data-cancel="${o.id_orden}">${ICON.xCircle()}Cancelar</button>`
    }
    if (o.estado === "completado") {
      return `<a class="act-btn act-edit" href="recibo.php?id=${o.id_orden}">Recibo</a>${btnWa}`
    }
    return '<span class="status-text">Cancelada</span>'
  }

  function botonesPieza(o, p) {
    if (o.estado !== "pendiente") return ""
    const btns = ACCIONES_PIEZA[p.estado].map(([accion, label]) =>
      `<button type="button" class="act-btn ${accion === "devolver" ? "act-del" : "act-edit"}" data-pieza-accion="${accion}" data-pieza="${p.id_pieza}" data-orden="${o.id_orden}">${label}</button>`)
    // en seguro las piezas no llevan precio; en particular sí se puede corregir
    if (p.estado !== "devuelta" && o.tipo === "particular") {
      btns.push(`<button type="button" class="act-btn act-gray" data-pieza-accion="precio" data-pieza="${p.id_pieza}" data-orden="${o.id_orden}">Precio</button>`)
    }
    if (ES_ADMIN && p.estado === "pendiente") {
      btns.push(`<button type="button" class="act-btn act-gray" data-pieza-quitar="${p.id_pieza}" data-orden="${o.id_orden}" title="Quitar pieza">×</button>`)
    }
    return `<div class="actions">${btns.join("")}</div>`
  }

  function filaPieza(o, p) {
    const reemplazo = p.id_reemplaza ? o.piezas.find((x) => x.id_pieza === p.id_reemplaza) : null
    const importe = piezaCobrable(p) ? money(p.precio_unitario * p.cantidad)
      : `<span class="muted">${o.tipo === "seguro" ? "Sin cargo al cliente" : "Sin precio"}</span>`
    return `
      <tr id="pieza-${p.id_pieza}"${p.estado === "devuelta" ? ' style="opacity:0.65"' : ""}>
        <td style="font-weight:600;color:var(--navy)">${esc(p.nombre)} ${p.es_extra ? extraBadge() : ""}
          ${reemplazo ? '<p class="p-sub">Reemplazo de pieza devuelta</p>' : ""}
          ${p.estado === "devuelta" && p.motivo_devolucion ? `<p class="p-sub">Motivo: ${esc(p.motivo_devolucion)}</p>` : ""}</td>
        <td>${ladoBadge(p.lado, true)}</td>
        ${o.tipo === "seguro" ? `<td>${esc(ORIGEN_LABEL[p.origen] || p.origen)}</td>` : ""}
        <td style="text-align:center;font-weight:700;color:var(--navy)">${p.cantidad}</td>
        <td>${importe}</td>
        <td>${piezaEstadoBadge(p.estado)}</td>
        <td>${botonesPieza(o, p)}</td>
      </tr>`
  }

  function tablaPiezas(o) {
    return `<div class="detail-table"><table>
      <thead><tr><th>Pieza</th><th>Lado</th>${o.tipo === "seguro" ? "<th>La consigue</th>" : ""}<th>Cant.</th><th>Importe</th><th>Estado</th><th></th></tr></thead>
      <tbody>${o.piezas.map((p) => filaPieza(o, p)).join("") || `<tr><td colspan="7" class="t-center muted">Sin piezas a cambio</td></tr>`}</tbody>
    </table></div>`
  }

  /** Mano de obra y extras: solo existen en órdenes particulares. */
  function listaCargos(o) {
    const abierta = o.estado === "pendiente"
    return o.cargos.map((c) => `
      <div class="sum-row"><span>${c.tipo === "extra" ? `${extraBadge()} ` : ""}${esc(c.concepto)}</span>
        <span class="flex" style="gap:0.4rem;align-items:center">${money(c.monto)}${abierta && ES_ADMIN
          ? `<button type="button" class="x-btn" data-cargo-quitar="${c.id_cargo}" data-orden="${o.id_orden}" aria-label="Quitar ${esc(c.concepto)}">×</button>` : ""}</span></div>`).join("")
      || '<p class="muted" style="font-size:0.82rem">Sin mano de obra ni extras</p>'
  }

  async function cambiarEtapa(o, etapa, onDone) {
    if (o.etapa === etapa) return
    const anterior = o.etapa
    o.etapa = etapa // respuesta inmediata en pantalla
    onDone(false)
    const { ok, data } = await api(`api/ordenes.php?id=${o.id_orden}&accion=etapa`, { method: "PATCH", body: { etapa } })
    if (!ok) {
      o.etapa = anterior
      onDone(false)
      return toast(data.error || "No se pudo cambiar la etapa", "error")
    }
    toast(`Orden #${pad4(o.id_orden)}: ${ETAPA_LABEL[etapa]}`)
    if (etapa === "listo" && o.telefono) toast("Puedes avisar al cliente con el botón WhatsApp", "info")
  }

  function registrarAnticipo(o, onDone) {
    miniModal({
      title: "REGISTRAR ANTICIPO",
      sub: `Orden #${pad4(o.id_orden)} · ${esc(o.cliente)}${o.anticipo > 0 ? ` · ya abonó ${money(o.anticipo)}` : ""}`,
      body: `
        <div class="field"><label class="label" for="ant-monto">Monto recibido (MXN)</label>
          <div class="money"><span>$</span><input class="input input-lg" id="ant-monto" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></div>
          <p class="hint">Total estimado de la orden: <b>${money(totalOrden(o))}</b></p></div>
        <div class="field"><label class="label" for="ant-metodo">Método de pago</label>
          <select class="input" id="ant-metodo">${Object.entries(METODO_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
        <p class="muted" style="font-size:0.78rem">Se descontará del total al cobrar la orden. Si la orden se cancela, se registra la devolución.</p>`,
      okText: "REGISTRAR",
      onSubmit: async (ov) => {
        const monto = parseFloat(ov.querySelector("#ant-monto").value)
        if (!(monto > 0)) return "Indica un monto mayor a cero"
        const pendiente = totalOrden(o) - (o.anticipo || 0)
        if (pendiente > 0 && monto > pendiente + 0.005) return `El anticipo no puede ser mayor a lo que falta por pagar (${money(pendiente)})`
        const { ok, data } = await api("api/pagos.php", {
          method: "POST",
          body: { id_orden: o.id_orden, monto, metodo: ov.querySelector("#ant-metodo").value },
        })
        if (!ok) return data.error || "No se pudo registrar el anticipo"
        toast(`Anticipo de ${money(monto)} registrado`)
        onDone(true)
        return null
      },
    })
  }

  function cancelar(o, onDone) {
    confirmDialog({
      icon: ICON.xCircle(24, "#64748B"),
      iconClass: "gray",
      title: "¿Cancelar orden?",
      detail: `<p class="t">Orden #${pad4(o.id_orden)}</p><p class="s">${esc(o.cliente)}</p><p class="m">${esc(o.placas)} · ${esc(o.vehiculo)}</p>`,
      note: o.anticipo > 0
        ? `Devuelve al cliente su anticipo de ${money(o.anticipo)}; quedará registrado en el corte de caja.`
        : "La orden no podrá cobrarse ni modificarse.",
      cancelText: "VOLVER",
      okText: "CANCELAR ORDEN",
      busyText: "CANCELANDO...",
      okClass: "btn-gray",
      onConfirm: async () => {
        const { ok, data } = await api(`api/ordenes.php?id=${o.id_orden}&accion=cancelar`, { method: "PATCH" })
        if (!ok) return data.error || "Error al cancelar la orden"
        toast(data.devuelto > 0 ? `Orden cancelada. Devolución registrada: ${money(data.devuelto)}` : "Orden cancelada")
        onDone(true)
        return null
      },
    })
  }

  /**
   * Atiende los clics de los botones de una orden.
   * @param {Event} e
   * @param {{buscar:(id:any)=>object, aseguradoras:()=>string[], onDone:(recargar:boolean)=>void, alFaltar?:(o:object)=>void}} ctx
   * @returns {boolean} true si el clic era de una acción de orden
   */
  function manejarClick(e, ctx) {
    const t = e.target
    const recargar = () => ctx.onDone(true)
    const et = t.closest("[data-etapa]")
    if (et) { cambiarEtapa(ctx.buscar(et.dataset.orden), et.dataset.etapa, ctx.onDone); return true }
    const an = t.closest("[data-anticipo]")
    if (an) { registrarAnticipo(ctx.buscar(an.dataset.anticipo), ctx.onDone); return true }
    const cn = t.closest("[data-cancel]")
    if (cn) { cancelar(ctx.buscar(cn.dataset.cancel), ctx.onDone); return true }
    const fa = t.closest("[data-faltan]")
    if (fa) {
      const o = ctx.buscar(fa.dataset.faltan)
      const f = faltantes(o)
      toast(`Para cobrar, marca como instalada${plural(f.length)}: ${f.map((p) => p.nombre).join(", ")}`, "error")
      if (ctx.alFaltar) ctx.alFaltar(o)
      return true
    }
    const pa = t.closest("[data-pieza-accion]")
    if (pa) {
      const o = ctx.buscar(pa.dataset.orden)
      const p = o.piezas.find((x) => x.id_pieza === Number(pa.dataset.pieza))
      const accion = pa.dataset.piezaAccion
      if (accion === "devolver") PiezasUI.devolver(p, recargar)
      else if (accion === "precio") PiezasUI.precio(p, recargar)
      else PiezasUI.cambiarEstado(p, accion, recargar)
      return true
    }
    const pq = t.closest("[data-pieza-quitar]")
    if (pq) {
      const o = ctx.buscar(pq.dataset.orden)
      PiezasUI.quitarPieza(o.piezas.find((x) => x.id_pieza === Number(pq.dataset.piezaQuitar)), recargar)
      return true
    }
    const cq = t.closest("[data-cargo-quitar]")
    if (cq) {
      const o = ctx.buscar(cq.dataset.orden)
      PiezasUI.quitarCargo(o.cargos.find((c) => c.id_cargo === Number(cq.dataset.cargoQuitar)), recargar)
      return true
    }
    const ap = t.closest("[data-add-pieza]")
    if (ap) { PiezasUI.agregarPieza(ctx.buscar(ap.dataset.addPieza), recargar); return true }
    const ac = t.closest("[data-add-cargo]")
    if (ac) { PiezasUI.agregarCargo(ctx.buscar(ac.dataset.addCargo), recargar); return true }
    const dt = t.closest("[data-datos]")
    if (dt) { PiezasUI.editarDatos(ctx.buscar(dt.dataset.datos), ctx.aseguradoras(), recargar); return true }
    return false
  }

  return { ETAPAS, totalOrden, piezasActivas, faltantes, estadoBadge, etapaCtrl, acciones, tablaPiezas, listaCargos, manejarClick }
})()
