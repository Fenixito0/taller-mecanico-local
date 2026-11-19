"use strict"

;(() => {
  const root = $("#cobro-root")
  const id = Number(root.dataset.id)
  const METODOS = [
    { value: "efectivo", label: "Efectivo", icon: sym("cash", 26) },
    { value: "tarjeta", label: "Tarjeta", icon: sym("card", 26) },
    { value: "transferencia", label: "Transferencia", icon: sym("bank", 26) },
  ]
  const ICON_USER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  const ICON_CAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>'
  const ICON_PRINT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>'
  const ICON_FILE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'

  let orden = null
  const st = { metodo: "efectivo", aplicaIva: true, efectivo: "", descTipo: "monto", descValor: "", processing: false }

  const decimalValido = (v) => v === "" || /^\d*\.?\d{0,2}$/.test(v)

  function calc() {
    const k = calcularCobro({ tipo: orden.tipo, piezas: orden.piezas, cargos: orden.cargos, deducible: orden.deducible,
      descTipo: st.descTipo, descValor: st.descValor, aplicaIva: st.aplicaIva, anticipo: orden.anticipo })
    const efectivo = parseFloat(st.efectivo) || 0
    const esEfectivo = st.metodo === "efectivo" && k.restante > 0
    return { ...k, efectivo,
      cambio: esEfectivo && efectivo > k.restante ? efectivo - k.restante : 0,
      insuficiente: esEfectivo && st.efectivo !== "" && efectivo < k.restante,
      faltan: orden.piezas.filter((p) => p.estado === "pendiente" || p.estado === "recibida") }
  }

  /** Montos sugeridos: exacto y redondeos hacia arriba a billetes comunes. */
  function opcionesEfectivo(total) {
    const set = new Set([Math.round(total * 100) / 100])
    ;[50, 100, 200, 500, 1000].forEach((m) => { const v = Math.ceil(total / m) * m; if (v > total) set.add(v) })
    return [...set].sort((a, b) => a - b).slice(0, 5)
  }

  function noEncontrada() {
    root.innerHTML = `
      <div class="center-screen">
        <p class="cond" style="font-size:1.5rem;font-weight:700;color:var(--navy)">Orden no encontrada</p>
        <p class="muted" style="margin-top:0.5rem">La orden #${id} no existe o ya fue procesada.</p>
        <a href="ordenes.php" class="btn btn-primary" style="margin-top:1.5rem;box-shadow:none">Volver a Órdenes</a>
      </div>`
  }

  function render() {
    const c = orden.cliente
    const v = orden.vehiculo
    const visibles = orden.piezas.filter((p) => p.estado !== "devuelta")
    const filas = visibles.map((p) => `
      <tr>
        <td style="font-weight:600;color:var(--navy);font-size:0.9rem">${esc(p.nombre)} ${p.es_extra ? extraBadge() : ""}</td>
        <td>${ladoBadge(p.lado, true)}</td>
        <td>${piezaEstadoBadge(p.estado)}</td>
        <td style="text-align:center;font-weight:700;color:var(--navy)">${p.cantidad}</td>
        <td style="font-weight:700;color:var(--navy)">${piezaCobrable(p) ? money(p.precio_unitario * p.cantidad) : `<span class="muted">${p.origen === "aseguradora" ? "Cubierta por " + esc(orden.aseguradora || "aseguradora") : "Sin cargo"}</span>`}</td>
      </tr>`).join("") || `<tr><td colspan="5" class="t-center muted">Sin piezas</td></tr>`
    const filasCargos = orden.cargos.filter((c) => c.tipo === "extra" || orden.tipo === "particular").map((c) => `
      <div class="sum-row"><span>${c.tipo === "extra" ? extraBadge() + " " : ""}${esc(c.concepto)}</span><span>${money(c.monto)}</span></div>`).join("")

    root.innerHTML = `
      <div class="page-head center">
        <a href="ordenes.php" class="back-btn" aria-label="Volver"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></a>
        <div>
          <h1 class="page-title">COBRAR VENTA</h1>
          <p class="page-sub" style="margin-top:0">Orden #${pad4(orden.id_orden)} · ${esc(fechaLarga(orden.fecha_creacion))}</p>
        </div>
      </div>
      <div class="alert" id="cobro-error" hidden></div>

      <div class="wizard wide-side">
        <div>
          <div class="info-cards">
            <div class="panel" style="margin-bottom:0">
              <div class="panel-head"><span class="t">${ICON_USER}Cliente</span></div>
              <div class="panel-body">
                <p style="font-weight:700;font-size:0.95rem;color:var(--navy)">${esc(c.nombre)} ${esc(c.apellido_paterno)} ${esc(c.apellido_materno || "")}</p>
                <p class="mono muted" style="font-size:0.75rem;margin-top:0.2rem">${esc(c.rfc)}</p>
                <p style="font-size:0.78rem;color:var(--text-3);margin-top:0.4rem">${esc(c.telefono || "")}</p>
                <p style="font-size:0.78rem;color:var(--text-3)">${esc(c.correo || "")}</p>
              </div>
            </div>
            <div class="panel" style="margin-bottom:0">
              <div class="panel-head"><span class="t">${ICON_CAR}Vehículo</span></div>
              <div class="panel-body">
                <p style="font-weight:700;font-size:0.95rem;color:var(--navy)">${esc(v.marca || "")} ${esc(v.modelo)}</p>
                <p style="font-size:0.78rem;color:var(--text-3);margin-top:0.2rem">${esc(v.anio)} · ${esc(v.color || "—")}</p>
                <div style="margin-top:0.6rem"><span class="plate" style="font-size:0.82rem;letter-spacing:0.1em">${esc(v.placas)}</span></div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head"><span class="t">Piezas · ${esc(TIPO_ORDEN_LABEL[orden.tipo])}${orden.tipo === "seguro" ? ` · ${esc(orden.aseguradora || "")}${orden.num_siniestro ? " · Siniestro " + esc(orden.num_siniestro) : ""}` : ""}</span></div>
            <table class="table-light">
              <thead><tr><th>Pieza</th><th>Lado</th><th>Estado</th><th>Cant.</th><th>Importe</th></tr></thead>
              <tbody>${filas}</tbody>
            </table>
            ${filasCargos ? `<div style="padding:0.75rem 1.25rem">${filasCargos}</div>` : ""}
          </div>

          <div class="panel">
            <div class="panel-head"><span class="t">Ajustes de Precio</span></div>
            <div style="padding:1.25rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem">
              <div>
                <label class="label" for="desc-valor">Descuento</label>
                <div class="desc-ctrl">
                  <div class="seg" role="group" aria-label="Tipo de descuento">
                    <button type="button" class="seg-btn" data-desc="monto" title="Monto fijo">$</button>
                    <button type="button" class="seg-btn" data-desc="porcentaje" title="Porcentaje">%</button>
                  </div>
                  <input class="input" id="desc-valor" inputmode="decimal" placeholder="0" style="background:#fff">
                </div>
                <p class="ferr" id="desc-err" hidden></p>
              </div>
              <div style="display:flex;align-items:center">
                <button type="button" class="toggle-box" id="toggle-iva">
                  <div class="switch"><i></i></div>
                  <div><p style="font-weight:600;font-size:0.85rem;color:var(--navy)">IVA 16%</p><p class="muted" style="font-size:0.72rem" id="iva-label"></p></div>
                </button>
              </div>
            </div>
          </div>

          <div class="panel" style="margin-bottom:0">
            <div class="panel-head"><span class="t">Método de Pago</span></div>
            <div style="padding:1.25rem">
              <div class="pay-opts">${METODOS.map((m) => `
                <button type="button" class="pay-opt" data-metodo="${m.value}"><div class="e">${m.icon}</div><p class="l">${m.label}</p></button>`).join("")}
              </div>
              <div id="efectivo-box" style="margin-top:1rem">
                <label class="label" for="efectivo">Efectivo recibido (MXN)</label>
                <div class="money"><span>$</span><input class="input" id="efectivo" inputmode="decimal" style="background:#fff"></div>
                <div class="quick-cash" id="quick-cash"></div>
                <div class="note-ok" id="cambio-box" hidden><span>Cambio a entregar</span><span class="cond" style="font-size:1.1rem;font-weight:800" id="cambio"></span></div>
                <div class="note-bad" id="insuf-box" hidden></div>
              </div>
            </div>
          </div>
        </div>

        <div class="side-panel">
          <div class="side-card" style="box-shadow:0 8px 30px rgba(15,31,61,0.1)">
            <div class="side-card-head" style="padding:1.1rem 1.25rem"><h3 style="font-size:1rem;letter-spacing:0.08em">Resumen de Cobro</h3></div>
            <div class="red-line"></div>
            <div class="side-card-body" id="resumen"></div>
          </div>
        </div>
      </div>`

    const ef = $("#efectivo")
    ef.addEventListener("input", () => {
      if (decimalValido(ef.value)) st.efectivo = ef.value
      ef.value = st.efectivo
      update()
    })
    $("#toggle-iva").addEventListener("click", () => { st.aplicaIva = !st.aplicaIva; update() })
    const dv = $("#desc-valor")
    dv.addEventListener("input", () => {
      if (decimalValido(dv.value)) st.descValor = dv.value
      dv.value = st.descValor
      update()
    })
    $$("[data-desc]").forEach((b) => b.addEventListener("click", () => { st.descTipo = b.dataset.desc; update(); dv.focus() }))
    $("#quick-cash").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cash]")
      if (!b) return
      st.efectivo = b.dataset.cash
      ef.value = st.efectivo
      update()
    })
    $$("[data-metodo]").forEach((b) => b.addEventListener("click", () => { st.metodo = b.dataset.metodo; update() }))
    update()
  }

  /** Actualiza solo las partes dinámicas (sin perder el foco de los inputs). */
  function update() {
    const k = calc()
    $("#toggle-iva").classList.toggle("on", st.aplicaIva)
    $("#iva-label").textContent = st.aplicaIva ? `+${money(k.iva)}` : "Sin IVA"
    $$("[data-desc]").forEach((b) => b.classList.toggle("on", b.dataset.desc === st.descTipo))
    $("#desc-valor").classList.toggle("err", k.descInvalido)
    $("#desc-err").hidden = !k.descInvalido
    $("#desc-err").textContent = st.descTipo === "porcentaje" ? "Máximo 100%" : "El descuento no puede ser mayor que el importe"
    $$("[data-metodo]").forEach((b) => b.classList.toggle("sel", b.dataset.metodo === st.metodo))
    $("#efectivo-box").hidden = st.metodo !== "efectivo" || k.restante <= 0
    $("#efectivo").placeholder = k.restante.toFixed(2)
    $("#efectivo").classList.toggle("err", k.insuficiente)
    $("#cambio-box").hidden = !(st.efectivo !== "" && !k.insuficiente)
    $("#cambio").textContent = money(k.cambio)
    $("#insuf-box").hidden = !k.insuficiente
    $("#insuf-box").textContent = `Monto insuficiente — faltan ${money(k.restante - k.efectivo)}`
    $("#quick-cash").innerHTML = opcionesEfectivo(k.restante).map((v, i) =>
      `<button type="button" class="chip${Number(st.efectivo) === v ? " active" : ""}" data-cash="${v.toFixed(2)}">${i === 0 ? "Exacto " : ""}${fmtMXN(v)}</button>`).join("")

    const bloqueado = st.processing || k.insuficiente || k.descInvalido || k.anticipoExcede || k.faltan.length > 0
    const metodoLabel = METODOS.find((m) => m.value === st.metodo).label
    $("#resumen").innerHTML = `
      ${k.faltan.length ? `<div class="note-bad">No se puede cobrar: faltan por instalar ${esc(k.faltan.map((p) => p.nombre).join(", "))}</div>` : ""}
      <div class="sum-row"><span>Piezas cobradas</span><span style="color:var(--text-2);font-weight:500">${money(k.piezas)}</span></div>
      ${orden.tipo === "particular" ? `<div class="sum-row"><span>Mano de obra</span><span style="color:var(--text-2);font-weight:500">${money(k.manoObra)}</span></div>` : ""}
      <div class="sum-row"><span>Extras</span><span style="color:var(--text-2);font-weight:500">${money(k.extras)}</span></div>
      ${k.descuento > 0 ? `<div class="sum-row"><span>Descuento${st.descTipo === "porcentaje" ? ` (${esc(st.descValor)}%)` : ""}</span><span class="text-green" style="font-weight:600">−${money(k.descuento)}</span></div>` : ""}
      <div class="sum-row"><b>Base</b><b>${money(k.base)}</b></div>
      <div class="sum-row"><span>IVA (16%)</span><span>${st.aplicaIva ? money(k.iva) : "—"}</span></div>
      ${orden.tipo === "seguro" ? `<div class="sum-row"><span>Deducible (IVA incluido)</span><span>${money(k.deducible)}</span></div>` : ""}
      <div class="sum-total"><span class="l">TOTAL</span><span class="v">${money(k.total)}</span></div>
      ${k.anticipo > 0 ? `<div class="sum-row" style="margin-top:0.6rem"><span>Anticipos recibidos</span><span class="text-green" style="font-weight:600">−${money(k.anticipo)}</span></div>
        <div class="sum-row"><b>Por cobrar ahora</b><b class="text-red" style="font-size:1.05rem">${money(k.restante)}</b></div>` : ""}
      ${k.anticipoExcede ? `<div class="note-bad">Los anticipos (${money(k.anticipo)}) superan el total. Revisa los cargos o el deducible.</div>` : ""}
      <p class="t-center muted" style="font-size:0.7rem;margin-top:0.4rem">MXN · ${k.restante > 0 ? metodoLabel : "Pagado con anticipos"}</p>
      <div style="margin-top:1rem;padding:0.75rem;background:#F0FDF4;border-radius:10px;border:1px solid #BBF7D0;display:flex;align-items:center;gap:0.5rem">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>
        <p style="font-size:0.75rem;color:var(--green);font-weight:500">Al cobrar, la orden se marcará como <strong>Completada</strong></p>
      </div>
      <button type="button" class="btn btn-primary btn-block btn-lg" id="btn-cobrar" style="margin-top:1rem" ${bloqueado ? "disabled" : ""}>
        ${st.processing ? '<span class="spinner sm" style="width:18px;height:18px"></span>PROCESANDO...' : `${ICON.money.replace(/13/g, "18")}REGISTRAR COBRO`}
      </button>
      <p class="kbd-hint t-center" style="display:block;margin-top:0.4rem">Ctrl + Enter para registrar</p>
      <a href="ordenes.php" class="btn btn-outline btn-block" style="margin-top:0.5rem;color:var(--muted);border-radius:12px;padding:0.75rem">CANCELAR</a>`
    $("#btn-cobrar").addEventListener("click", cobrar)
  }

  async function cobrar() {
    const k = calc()
    if (k.insuficiente || st.processing) return
    st.processing = true
    update()
    const errBox = $("#cobro-error")
    errBox.hidden = true
    try {
      const { ok, data } = await api("api/ventas.php", {
        method: "POST",
        body: {
          id_orden: orden.id_orden, aplica_iva: st.aplicaIva, metodo_pago: st.metodo,
          descuento_tipo: st.descTipo, descuento_valor: parseFloat(st.descValor) || 0,
        },
      })
      if (ok) return exito(data.precio_total ?? k.total, data.cobrado_ahora ?? k.restante)
      errBox.textContent = data.error || "Error al registrar la venta"
    } catch {
      errBox.textContent = "Error de conexión"
    }
    errBox.hidden = false
    st.processing = false
    update()
  }

  function exito(total, cobrado) {
    root.innerHTML = `
      <div class="center-screen">
        <div class="success-box">
          <div class="success-ico" style="width:90px;height:90px;box-shadow:0 8px 30px rgba(22,163,74,0.25)">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style="font-size:2rem">¡Venta Registrada!</h2>
          <p style="color:var(--text-3)">Total de la venta: <strong class="text-red">${money(total)} MXN</strong></p>
          ${Math.abs(total - cobrado) > 0.009 ? `<p class="muted" style="font-size:0.85rem">Cobrado ahora: <b>${money(cobrado)}</b> · anticipos: <b>${money(total - cobrado)}</b></p>` : ""}
          <p class="muted" style="font-size:0.82rem;margin-top:0.3rem">La orden fue marcada como <strong class="text-green">Completada</strong></p>
          <div class="flex" style="gap:0.75rem;margin-top:1.5rem;justify-content:center;flex-wrap:wrap">
            <a href="recibo.php?id=${id}" class="btn btn-primary" style="padding:0.85rem 1.5rem;border-radius:12px;font-size:0.9rem">${ICON_PRINT}VER RECIBO</a>
            <button type="button" class="btn btn-excel" id="btn-excel" style="padding:0.85rem 1.5rem;border-radius:12px;font-size:0.9rem">${ICON_FILE}DESCARGAR EXCEL</button>
            <a href="ordenes.php" class="btn btn-outline" style="padding:0.85rem 1.5rem;border-radius:12px;font-size:0.9rem">VOLVER A ÓRDENES</a>
          </div>
        </div>
      </div>`
    $("#btn-excel").addEventListener("click", () => descargar(`api/excel.php?tipo=orden&id=${id}`))
  }

  // Ctrl+Enter registra el cobro
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && orden && !$(".overlay")) {
      e.preventDefault()
      $("#btn-cobrar")?.click()
    }
  })

  api(`api/ordenes.php?id=${id}`).then(({ ok, data }) => {
    if (!ok || data.estado !== "pendiente") return noEncontrada()
    orden = data
    render()
  }).catch(noEncontrada)
})()
