/* Detalle de una orden en su propia página (orden.php?id=N). */
"use strict"

;(() => {
  const root = $("#orden-root")
  const id = Number(root.dataset.id)
  let o = null
  let taller = { nombre_taller: "el taller" }
  let aseguradoras = []

  const BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>'
  const PRINT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>'
  const PAGO_LABEL = { anticipo: "Anticipo", liquidacion: "Liquidación", devolucion: "Devolución" }

  function noEncontrada(msg) {
    root.innerHTML = `<div class="center-screen"><div class="success-box">
      <h2>${esc(msg)}</h2>
      <a href="ordenes.php" class="btn btn-primary" style="margin-top:1.5rem;box-shadow:none">Volver a Órdenes</a></div></div>`
  }

  /** La API de detalle trae cliente y vehículo como objetos; aquí se dejan como en la lista de órdenes. */
  function adaptar(d) {
    const c = d.cliente
    const v = d.vehiculo
    return {
      ...d,
      cliente: [c.nombre, c.apellido_paterno, c.apellido_materno].filter(Boolean).join(" "),
      clienteDatos: c,
      telefono: c.telefono,
      rfc: c.rfc,
      placas: v.placas,
      vehiculo: [v.marca, v.modelo, v.anio].filter(Boolean).join(" "),
      vehiculoDatos: v,
    }
  }

  async function cargar() {
    const { ok, data, status } = await api(`api/ordenes.php?id=${id}`)
    if (!ok) return noEncontrada(status === 404 ? `La orden #${pad4(id)} no existe` : data.error || "No se pudo cargar la orden")
    o = adaptar(data)
    render()
  }

  function render() {
    const abierta = o.estado === "pendiente"
    const seguro = o.tipo === "seguro"
    const k = calcularCobro({ tipo: o.tipo, piezas: o.piezas, cargos: o.cargos, deducible: o.deducible })
    const total = o.total_venta ?? k.total
    const f = OrdenUI.faltantes(o)
    const v = o.vehiculoDatos
    const c = o.clienteDatos
    const btnSec = (attr, label) => abierta ? `<button type="button" class="btn btn-soft" style="margin-left:auto;font-size:0.8rem;padding:0.45rem 0.9rem" ${attr}>${label}</button>` : ""

    root.innerHTML = `
      <div class="od-head">
        <div class="flex" style="gap:0.9rem;align-items:center">
          <a href="ordenes.php" class="back-btn no-print" aria-label="Volver a órdenes">${BACK}</a>
          <div>
            <p class="od-folio">ORDEN #${pad4(o.id_orden)}</p>
            <p class="od-sub">${esc(fechaLarga(o.fecha_creacion))}${o.creada_por ? ` · la registró ${esc(o.creada_por)}` : ""}</p>
          </div>
        </div>
        <div>${OrdenUI.etapaCtrl(o)}</div>
      </div>

      <div class="od-actions no-print" style="margin-bottom:1.25rem">
        ${OrdenUI.acciones(o, taller)}
        <button type="button" class="act-btn act-gray" id="btn-imprimir">${PRINT}Imprimir</button>
      </div>
      ${abierta && f.length ? `<div class="alert" style="margin-bottom:1.25rem">Para cobrar faltan ${f.length} pieza${plural(f.length)} por instalar: <b>${f.map((p) => esc(p.nombre)).join(", ")}</b>.</div>` : ""}

      <div class="od-grid">
        <div class="od-card">
          <p class="od-k">CLIENTE</p>
          <p class="od-big">${esc(o.cliente)}</p>
          <p class="od-sub">${c.telefono ? `Tel. ${esc(c.telefono)} · ` : ""}<span class="mono">${esc(c.rfc)}</span></p>
        </div>
        <div class="od-card">
          <p class="od-k">VEHÍCULO</p>
          <p class="od-big">${esc([v.marca, v.modelo].filter(Boolean).join(" "))} ${esc(v.anio)}</p>
          <p style="margin-top:0.4rem"><span class="plate plate-lg">${esc(v.placas)}</span></p>
          <p class="od-sub">${esc(v.color || "Sin color")}${o.kilometraje !== null ? ` · ${km(o.kilometraje)}` : ""}</p>
        </div>
        <div class="od-card">
          <p class="od-k">TIPO DE ORDEN ${abierta ? '<button type="button" class="link-btn no-print" data-datos="' + o.id_orden + '" style="float:right">Editar</button>' : ""}</p>
          <p class="od-big">${seguro ? esc(o.aseguradora || "Seguro") : "Particular"}</p>
          ${seguro ? `<p class="od-sub">Siniestro: <b class="mono" style="color:var(--navy);font-size:1rem">${esc(o.num_siniestro || "—")}</b></p>
            <p class="od-sub">Deducible: <b>${money(o.deducible)}</b></p>` : '<p class="od-sub">Lo paga el cliente</p>'}
        </div>
        <div class="od-card" style="border-color:#FECDD3">
          <p class="od-k">${o.estado === "completado" ? "COBRADO" : "A COBRAR AL CLIENTE"}</p>
          <p class="od-total">${money(total)}</p>
          <p class="od-sub">${o.estado === "completado" ? "Orden pagada" : seguro ? "Deducible (IVA incluido)" : "Estimado con IVA, sin descuento"}${o.anticipo > 0 && abierta ? ` · anticipos ${money(o.anticipo)} · resta <b>${money(Math.max(0, total - o.anticipo))}</b>` : ""}</p>
        </div>
      </div>

      <div class="od-section" id="piezas">
        <div class="detail-title">${ICON.wrench()}Piezas a cambio (${OrdenUI.piezasActivas(o)})${btnSec(`data-add-pieza="${o.id_orden}"`, "+ Agregar pieza")}</div>
        ${OrdenUI.tablaPiezas(o)}
      </div>

      ${seguro ? "" : `<div class="od-section">
        <div class="detail-title">${sym("cash", 14)}Mano de obra y extras${btnSec(`data-add-cargo="${o.id_orden}"`, "+ Agregar cargo")}</div>
        ${OrdenUI.listaCargos(o)}
        <div style="margin-top:0.75rem;max-width:360px;margin-left:auto">
          <div class="sum-row"><span>Piezas</span><span>${money(k.piezas)}</span></div>
          <div class="sum-row"><span>Mano de obra</span><span>${money(k.manoObra)}</span></div>
          <div class="sum-row"><span>Extras</span><span>${money(k.extras)}</span></div>
          <div class="sum-row"><span>IVA (16%)</span><span>${money(k.iva)}</span></div>
          <div class="side-total-lg"><span class="k">TOTAL</span><span class="v">${money(k.total)}</span></div>
        </div>
      </div>`}

      ${o.pagos?.length ? `<div class="od-section">
        <div class="detail-title">${ICON.money}Pagos</div>
        ${o.pagos.map((p) => `<div class="sum-row"><span>${esc(PAGO_LABEL[p.tipo] || p.tipo)} · ${esc(METODO_LABEL[p.metodo] || p.metodo)} · <span class="muted">${esc(fechaMes(p.fecha))}</span></span><b>${money(p.monto)}</b></div>`).join("")}
      </div>` : ""}

      ${o.observaciones ? `<div class="od-section">
        <div class="detail-title">${sym("note", 14)}Observaciones</div>
        <p style="font-size:0.92rem;color:var(--navy);line-height:1.6;white-space:pre-wrap">${esc(o.observaciones)}</p>
      </div>` : ""}`

    $("#btn-imprimir").addEventListener("click", () => window.print())
    document.title = `Orden #${pad4(o.id_orden)} · ${o.cliente}`
  }

  root.addEventListener("click", (e) => {
    if (!o) return
    OrdenUI.manejarClick(e, {
      buscar: () => o,
      aseguradoras: () => aseguradoras,
      onDone: (recargar) => (recargar ? cargar() : render()),
      alFaltar: () => {
        const pz = $("#piezas")
        pz.scrollIntoView({ block: "start", behavior: "smooth" })
        pz.classList.add("falta")
        setTimeout(() => pz.classList.remove("falta"), 2600)
      },
    })
  })

  if (!(id > 0)) return noEncontrada("Falta el número de orden")
  api("api/configuracion.php").then(({ ok, data }) => { if (ok) { taller = data; aseguradoras = data.aseguradoras || [] } })
  cargar().then(() => { if (location.hash === "#piezas") $("#piezas")?.scrollIntoView({ block: "start" }) })
})()
