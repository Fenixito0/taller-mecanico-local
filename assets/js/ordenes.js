"use strict"

;(() => {
  let ordenes = []
  let filtroEstado = "todos"
  let taller = { nombre_taller: "el taller" }
  const expandidas = new Set()
  const ETAPAS = ["recibido", "reparacion", "listo"]

  async function cargar() {
    const { ok, data } = await api("api/ordenes.php")
    ordenes = ok && Array.isArray(data) ? data : []
    $("#count-label").textContent = `${ordenes.length} orden${plural(ordenes.length, "es")} registrada${plural(ordenes.length)}`
    ;["pendiente", "completado", "cancelado"].forEach((e) => {
      $(`#c-${e}`).textContent = ordenes.filter((o) => o.estado === e).length
    })
    render()
  }

  /** Total estimado a cobrar al cliente (sin descuento). */
  const totalOrden = (o) => calcularCobro({ tipo: o.tipo, piezas: o.piezas, cargos: o.cargos, deducible: o.deducible }).total
  const piezasOrden = (o) => o.piezas.filter((p) => p.estado !== "devuelta").length
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

  function mensajeWhatsApp(o) {
    const total = o.total_venta ?? totalOrden(o)
    const base = `Hola ${o.cliente.split(" ")[0]}, le escribimos de ${taller.nombre_taller}.`
    if (o.estado === "completado") return `${base} Gracias por su preferencia. Su orden #${pad4(o.id_orden)} (${o.vehiculo}, placas ${o.placas}) quedó pagada por ${fmtMXN(total)}.`
    if (o.etapa === "listo") return `${base} Su vehículo ${o.vehiculo} con placas ${o.placas} ya está listo para entregar. ${o.tipo === "seguro" ? "Monto a pagar (deducible y extras)" : "Total estimado"}: ${fmtMXN(totalOrden(o))}${o.anticipo > 0 ? ` (anticipo recibido: ${fmtMXN(o.anticipo)})` : ""}.`
    return `${base} Le informamos que su vehículo ${o.vehiculo} con placas ${o.placas} se encuentra: ${ETAPA_LABEL[o.etapa]}. Orden #${pad4(o.id_orden)}.`
  }

  function botonesPieza(o, p) {
    if (o.estado !== "pendiente") return ""
    const btns = ACCIONES_PIEZA[p.estado].map(([accion, label]) =>
      `<button type="button" class="act-btn ${accion === "devolver" ? "act-del" : "act-edit"}" data-pieza-accion="${accion}" data-pieza="${p.id_pieza}" data-orden="${o.id_orden}">${label}</button>`)
    if (p.estado !== "devuelta") {
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
      : `<span class="muted">${p.origen === "aseguradora" ? "Aseguradora" : "Sin cargo"}</span>`
    return `
      <tr${p.estado === "devuelta" ? ' style="opacity:0.65"' : ""}>
        <td style="font-weight:600;color:var(--navy)">${esc(p.nombre)} ${p.es_extra ? extraBadge() : ""}
          ${reemplazo ? '<p class="p-sub">Reemplazo de pieza devuelta</p>' : ""}
          ${p.estado === "devuelta" && p.motivo_devolucion ? `<p class="p-sub">Motivo: ${esc(p.motivo_devolucion)}</p>` : ""}</td>
        <td>${ladoBadge(p.lado, true)}</td>
        <td>${esc(ORIGEN_LABEL[p.origen] || p.origen)}</td>
        <td style="text-align:center;font-weight:700;color:var(--navy)">${p.cantidad}</td>
        <td>${importe}</td>
        <td>${piezaEstadoBadge(p.estado)}</td>
        <td>${botonesPieza(o, p)}</td>
      </tr>`
  }

  function filaDetalle(o) {
    const abierta = o.estado === "pendiente"
    const k = calcularCobro({ tipo: o.tipo, piezas: o.piezas, cargos: o.cargos, deducible: o.deducible })
    const datos = [
      `<span><b>Tipo:</b> ${esc(TIPO_ORDEN_LABEL[o.tipo] || o.tipo)}</span>`,
      o.tipo === "seguro" ? `<span><b>Aseguradora:</b> ${esc(o.aseguradora || "—")}</span>` : "",
      o.tipo === "seguro" && o.num_siniestro ? `<span><b>Siniestro:</b> ${esc(o.num_siniestro)}</span>` : "",
      o.tipo === "seguro" ? `<span><b>Deducible:</b> ${money(o.deducible)}</span>` : "",
      o.kilometraje !== null ? `<span><b>Kilometraje:</b> ${km(o.kilometraje)}</span>` : "",
      o.anticipo > 0 ? `<span><b>Anticipos:</b> ${money(o.anticipo)}</span>` : "",
      abierta ? `<button type="button" class="link-btn" data-datos="${o.id_orden}">Editar datos</button>` : "",
      o.observaciones ? `<span style="flex-basis:100%"><b>Observaciones:</b> ${esc(o.observaciones)}</span>` : "",
    ].filter(Boolean).join("")
    const cargos = o.cargos.filter((c) => c.tipo === "extra" || o.tipo === "particular").map((c) => `
      <div class="sum-row"><span>${c.tipo === "extra" ? `${extraBadge()} ` : ""}${esc(c.concepto)}</span>
        <span class="flex" style="gap:0.4rem;align-items:center">${money(c.monto)}${abierta && ES_ADMIN
          ? `<button type="button" class="x-btn" data-cargo-quitar="${c.id_cargo}" data-orden="${o.id_orden}" aria-label="Quitar ${esc(c.concepto)}">×</button>` : ""}</span></div>`).join("")
    return `
      <tr class="detail-row"><td colspan="8">
        <div class="detail-box">
          <div class="detail-extras">${datos}</div>
          <div class="detail-title">${ICON.wrench()}Piezas a cambio
            ${abierta ? `<button type="button" class="btn btn-soft" style="margin-left:auto;font-size:0.75rem;padding:0.35rem 0.75rem" data-add-pieza="${o.id_orden}">+ Pieza</button>` : ""}</div>
          <div class="detail-table"><table>
            <thead><tr><th>Pieza</th><th>Lado</th><th>La consigue</th><th>Cant.</th><th>Importe</th><th>Estado</th><th></th></tr></thead>
            <tbody>${o.piezas.map((p) => filaPieza(o, p)).join("") || '<tr><td colspan="7" class="t-center muted">Sin piezas a cambio</td></tr>'}</tbody>
          </table></div>
          <div class="detail-title" style="margin-top:1rem">${sym("cash", 14)}${o.tipo === "seguro" ? "Extras" : "Mano de obra y extras"}
            ${abierta ? `<button type="button" class="btn btn-soft" style="margin-left:auto;font-size:0.75rem;padding:0.35rem 0.75rem" data-add-cargo="${o.id_orden}">+ Cargo</button>` : ""}</div>
          ${cargos || '<p class="muted" style="font-size:0.82rem">Sin cargos</p>'}
          <div class="sum-row" style="margin-top:0.75rem;border-top:1px solid var(--border);padding-top:0.5rem">
            <b>${o.estado === "completado" ? "Cobrado" : "A cobrar (estimado, con IVA)"}</b><b>${money(o.total_venta ?? k.total)}</b></div>
        </div>
      </td></tr>`
  }

  function acciones(o) {
    const wa = whatsappUrl(o.telefono, mensajeWhatsApp(o))
    const btnWa = wa
      ? `<a class="act-btn act-wa" href="${esc(wa)}" target="_blank" rel="noopener" title="Abrir WhatsApp con el mensaje listo">${sym("note", 13)}WhatsApp</a>`
      : ""
    if (o.estado === "pendiente") {
      const f = faltantes(o).length
      const cobrar = f > 0
        ? `<span class="act-btn act-gray" title="Marca las piezas como instaladas para poder cobrar">${sym("wrench", 13)}Faltan ${f} pieza${plural(f)}</span>`
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

  function render() {
    const q = norm($("#search").value)
    const filtered = ordenes.filter((o) =>
      norm(`#${pad4(o.id_orden)} ${o.id_orden} ${o.cliente} ${o.placas} ${o.vehiculo}`).includes(q)
      && (filtroEstado === "todos"
        || (filtroEstado === "listo" ? o.estado === "pendiente" && o.etapa === "listo" : o.estado === filtroEstado)))

    const foot = $("#foot")
    if (filtered.length === 0) {
      $("#table-wrap").innerHTML = '<div style="padding:4rem;text-align:center"><p class="muted" style="font-size:0.95rem">No hay órdenes que mostrar</p></div>'
      foot.hidden = true
      return
    }

    const rows = filtered.map((o) => {
      const open = expandidas.has(o.id_orden)
      const total = totalOrden(o)
      const n = piezasOrden(o)
      const f = o.estado === "pendiente" ? faltantes(o).length : 0
      return `
        <tr class="row${open ? " open" : ""}">
          <td style="width:40px;padding:0.95rem 0.5rem 0.95rem 1.25rem">
            <button type="button" class="expand-btn" data-toggle="${o.id_orden}" aria-label="Ver detalle">${ICON.chevDown}</button>
          </td>
          <td><span class="tag bold" style="letter-spacing:0">#${pad4(o.id_orden)}</span></td>
          <td><p class="p-main">${esc(o.cliente)}</p><p class="p-sub">${esc(o.telefono || o.rfc)}</p></td>
          <td><p class="p-main" style="font-weight:400">${esc(o.vehiculo)}</p><p class="p-sub mono">${esc(o.placas)}${o.kilometraje !== null ? ` · ${km(o.kilometraje)}` : ""}</p></td>
          <td><p class="p-main" style="font-weight:700;font-size:0.9rem">${money(o.total_venta ?? total)}</p>
            <p class="p-sub" style="font-size:0.72rem">${esc(o.tipo === "seguro" ? o.aseguradora || "Seguro" : "Particular")} · ${n} pieza${plural(n)}${f > 0 ? ` · <b class="text-red">faltan ${f}</b>` : ""}${o.anticipo > 0 && o.estado === "pendiente" ? ` · anticipo ${money(o.anticipo)}` : ""}</p></td>
          <td style="font-size:0.82rem;color:var(--text-3)">${esc(fechaMes(o.fecha_creacion))}</td>
          <td>${etapaCtrl(o)}</td>
          <td><div class="actions">${acciones(o)}</div></td>
        </tr>
        ${open ? filaDetalle(o) : ""}`
    }).join("")

    $("#table-wrap").innerHTML = `
      <table class="table">
        <thead><tr><th style="width:40px"></th><th># Orden</th><th>Cliente</th><th>Vehículo</th><th>Total</th><th>Fecha</th><th>Etapa / estado</th><th>Acciones</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    foot.hidden = false
    foot.textContent = `Mostrando ${filtered.length} de ${ordenes.length} órdenes`
  }

  async function cambiarEtapa(o, etapa) {
    if (o.etapa === etapa) return
    const anterior = o.etapa
    o.etapa = etapa // respuesta inmediata en pantalla
    render()
    const { ok, data } = await api(`api/ordenes.php?id=${o.id_orden}&accion=etapa`, { method: "PATCH", body: { etapa } })
    if (!ok) {
      o.etapa = anterior
      render()
      return toast(data.error || "No se pudo cambiar la etapa", "error")
    }
    toast(`Orden #${pad4(o.id_orden)}: ${ETAPA_LABEL[etapa]}`)
    if (etapa === "listo" && o.telefono) toast("Puedes avisar al cliente con el botón WhatsApp", "info")
  }

  function registrarAnticipo(o) {
    miniModal({
      title: "REGISTRAR ANTICIPO",
      sub: `Orden #${pad4(o.id_orden)} · ${esc(o.cliente)}${o.anticipo > 0 ? ` · ya abonó ${money(o.anticipo)}` : ""}`,
      body: `
        <div class="field"><label class="label" for="ant-monto">Monto recibido (MXN)</label>
          <div class="money"><span>$</span><input class="input" id="ant-monto" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></div></div>
        <div class="field"><label class="label" for="ant-metodo">Método de pago</label>
          <select class="input" id="ant-metodo">${Object.entries(METODO_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
        <p class="muted" style="font-size:0.78rem">Se descontará del total al cobrar la orden. Si la orden se cancela, se registra la devolución.</p>`,
      okText: "REGISTRAR",
      onSubmit: async (ov) => {
        const monto = parseFloat(ov.querySelector("#ant-monto").value)
        if (!(monto > 0)) return "Indica un monto mayor a cero"
        const { ok, data } = await api("api/pagos.php", {
          method: "POST",
          body: { id_orden: o.id_orden, monto, metodo: ov.querySelector("#ant-metodo").value },
        })
        if (!ok) return data.error || "No se pudo registrar el anticipo"
        toast(`Anticipo de ${money(monto)} registrado`)
        cargar()
        return null
      },
    })
  }

  function cancelar(o) {
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
        cargar()
        return null
      },
    })
  }

  const buscar = (id) => ordenes.find((o) => o.id_orden === Number(id))
  const buscarPieza = (o, id) => o.piezas.find((p) => p.id_pieza === Number(id))
  let aseguradoras = []

  $("#search").addEventListener("input", debounce(render))
  $("#filtro-estado").addEventListener("click", (e) => {
    const b = e.target.closest("[data-val]")
    if (!b) return
    filtroEstado = b.dataset.val
    $$("#filtro-estado .chip").forEach((c) => c.classList.toggle("active", c === b))
    render()
  })
  $("#table-wrap").addEventListener("click", (e) => {
    const t = e.target
    const tg = t.closest("[data-toggle]")
    if (tg) {
      const id = Number(tg.dataset.toggle)
      if (expandidas.has(id)) expandidas.delete(id)
      else expandidas.add(id)
      return render()
    }
    const et = t.closest("[data-etapa]")
    if (et) return cambiarEtapa(buscar(et.dataset.orden), et.dataset.etapa)
    const an = t.closest("[data-anticipo]")
    if (an) return registrarAnticipo(buscar(an.dataset.anticipo))
    const cn = t.closest("[data-cancel]")
    if (cn) return cancelar(buscar(cn.dataset.cancel))
    const pa = t.closest("[data-pieza-accion]")
    if (pa) {
      const o = buscar(pa.dataset.orden)
      const p = buscarPieza(o, pa.dataset.pieza)
      const accion = pa.dataset.piezaAccion
      if (accion === "devolver") return PiezasUI.devolver(p, cargar)
      if (accion === "precio") return PiezasUI.precio(p, cargar)
      return PiezasUI.cambiarEstado(p, accion, cargar)
    }
    const pq = t.closest("[data-pieza-quitar]")
    if (pq) { const o = buscar(pq.dataset.orden); return PiezasUI.quitarPieza(buscarPieza(o, pq.dataset.piezaQuitar), cargar) }
    const cq = t.closest("[data-cargo-quitar]")
    if (cq) { const o = buscar(cq.dataset.orden); return PiezasUI.quitarCargo(o.cargos.find((c) => c.id_cargo === Number(cq.dataset.cargoQuitar)), cargar) }
    const ap = t.closest("[data-add-pieza]")
    if (ap) return PiezasUI.agregarPieza(buscar(ap.dataset.addPieza), cargar)
    const ac = t.closest("[data-add-cargo]")
    if (ac) return PiezasUI.agregarCargo(buscar(ac.dataset.addCargo), cargar)
    const dt = t.closest("[data-datos]")
    if (dt) return PiezasUI.editarDatos(buscar(dt.dataset.datos), aseguradoras, cargar)
  })

  api("api/configuracion.php").then(({ ok, data }) => { if (ok) { taller = data; aseguradoras = data.aseguradoras || [] } })
  // ordenes.php?id=N abre directamente el detalle de esa orden
  const idInicial = Number(new URLSearchParams(location.search).get("id"))
  if (idInicial > 0) expandidas.add(idInicial)
  cargar().then(() => {
    if (idInicial > 0) $(`[data-toggle="${idInicial}"]`)?.scrollIntoView({ block: "center" })
  })
})()
