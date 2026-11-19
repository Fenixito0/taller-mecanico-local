"use strict"

;(() => {
  const STEPS = ["Cliente", "Vehículo", "Trabajo", "Confirmar"]
  const DRAFT_KEY = "ordenBorrador2"
  const SEARCH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
  const ARROW_R = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'
  const CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
  const PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'

  const PIEZA_VACIA = { nombre: "", lado: "NA", origen: "", cantidad: "1", precio: "", es_extra: false }

  const state = {
    step: 1,
    cliente: null,
    vehiculo: null,
    tipo: "seguro",          // seguro | particular
    aseguradora: "",
    siniestro: "",
    deducible: "",
    piezas: [],              // [{key, nombre, lado, origen, cantidad, precio_unitario, es_extra}]
    cargos: [],              // [{key, tipo, concepto, monto}]
    nuevaPieza: { ...PIEZA_VACIA },
    nuevoExtra: { concepto: "", monto: "" },
    manoObra: "",
    observaciones: "",
    kilometraje: "",
    historial: null,         // últimas órdenes del cliente seleccionado
    clientes: null,          // null = cargando
    vehiculos: null,         // todos los vehículos (se filtran por cliente)
    aseguradoras: [],
    qCliente: "",
    saving: false,
    error: "",
    errPieza: "",
  }
  let seq = 0
  const nuevaKey = () => `k${Date.now()}_${seq++}`

  // ── Borrador (no se pierde el avance al recargar o cambiar de página) ──
  function guardarBorrador() {
    if (state.clientes === null) return // aún cargando: no tocar el borrador guardado
    const hayAvance = state.cliente || state.piezas.length || state.cargos.length || state.observaciones
    $("#btn-reset").hidden = !hayAvance
    if (!hayAvance) return sessionStorage.removeItem(DRAFT_KEY)
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      step: state.step,
      rfc: state.cliente?.rfc || null,
      idVeh: state.vehiculo?.id_vehiculo || null,
      tipo: state.tipo, aseguradora: state.aseguradora, siniestro: state.siniestro, deducible: state.deducible,
      piezas: state.piezas, cargos: state.cargos, manoObra: state.manoObra,
      obs: state.observaciones,
      km: state.kilometraje,
    }))
  }

  function restaurarBorrador() {
    sessionStorage.removeItem("ordenBorrador") // borrador del formato anterior (con inventario)
    let d
    try { d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null") } catch { d = null }
    if (!d) return
    state.cliente = state.clientes.find((c) => c.rfc === d.rfc) || null
    state.vehiculo = state.cliente ? vehiculosDe(state.cliente.rfc).find((v) => v.id_vehiculo === d.idVeh) || null : null
    state.tipo = d.tipo === "particular" ? "particular" : "seguro"
    state.aseguradora = state.aseguradoras.includes(d.aseguradora) ? d.aseguradora : ""
    state.siniestro = d.siniestro || ""
    state.deducible = d.deducible || ""
    state.piezas = Array.isArray(d.piezas) ? d.piezas : []
    state.cargos = Array.isArray(d.cargos) ? d.cargos : []
    state.manoObra = d.manoObra || ""
    state.observaciones = d.obs || ""
    state.kilometraje = d.km || ""
    if (state.cliente) cargarHistorial(state.cliente.rfc)
    state.step = Math.min(d.step || 1, maxPaso())
    if (state.cliente) toast("Se recuperó la orden que tenías en progreso", "info")
  }

  // ── Utilidades ─────────────────────────────────────────────────────
  const vehiculosDe = (rfc) => (state.vehiculos || []).filter((v) => v.rfc_cliente === rfc)
  const esSeguro = () => state.tipo === "seguro"

  /** Cargos que se enviarán (mano de obra solo en particular). */
  function cargosFinales() {
    const mo = parseFloat(state.manoObra) || 0
    const extras = state.cargos.filter((c) => c.tipo === "extra")
    return !esSeguro() && mo > 0 ? [{ tipo: "mano_obra", concepto: "Mano de obra", monto: mo }, ...extras] : extras
  }
  const cobro = () => calcularCobro({ tipo: state.tipo, piezas: state.piezas.map((p) => ({ ...p, estado: "pendiente" })), cargos: cargosFinales(), deducible: state.deducible })

  async function cargarHistorial(rfc) {
    state.historial = null
    const { ok, data } = await api(`api/ordenes.php?historial=${encodeURIComponent(rfc)}`)
    if (state.cliente?.rfc !== rfc) return
    state.historial = ok && Array.isArray(data) ? data : []
    const box = $("#historial-box")
    if (box) box.innerHTML = historialHtml()
    const kmHint = $("#km-hint")
    if (kmHint) kmHint.textContent = textoUltimoKm()
  }

  /** Último kilometraje registrado del vehículo seleccionado. */
  function ultimoKm() {
    const h = (state.historial || []).find((o) => o.id_vehiculo === state.vehiculo?.id_vehiculo && o.kilometraje !== null)
    return h ? h.kilometraje : null
  }
  const textoUltimoKm = () => {
    const u = ultimoKm()
    return u === null ? "Opcional" : `Último registrado: ${km(u)}`
  }

  function historialHtml() {
    if (state.historial === null) return '<p class="muted" style="font-size:0.82rem">Cargando historial...</p>'
    if (state.historial.length === 0) return '<p class="muted" style="font-size:0.82rem">Este cliente no tiene órdenes anteriores.</p>'
    return `<div class="hist-list">${state.historial.map((o) => `
      <div class="hist-item">
        <div class="flex" style="justify-content:space-between;gap:0.5rem;flex-wrap:wrap">
          <span><b>#${pad4(o.id_orden)}</b> · ${esc(fechaMes(o.fecha))} · <span class="mono">${esc(o.placas)}</span>${o.kilometraje !== null ? ` · ${km(o.kilometraje)}` : ""}</span>
          <span class="badge xs estado-${esc(o.estado)}">${esc(ESTADO_LABEL[o.estado])}</span>
        </div>
        <p class="muted" style="font-size:0.78rem;margin-top:0.2rem">${esc(o.refacciones.join(", ") || "—")}${o.total !== null ? ` · <b style="color:var(--navy)">${money(o.total)}</b>` : ""}</p>
      </div>`).join("")}</div>`
  }
  const nombreCliente = (c) => `${c.nombre} ${c.apellido_paterno} ${c.apellido_materno || ""}`.trim()

  /** Último paso al que se puede llegar con lo seleccionado. */
  function maxPaso() {
    if (!state.cliente) return 1
    if (!state.vehiculo) return 2
    if (esSeguro() && !state.aseguradora) return 3
    return 4
  }
  const canNext = () => maxPaso() > state.step

  function irA(paso) {
    if (paso < 1 || paso > maxPaso()) return
    state.step = paso
    state.error = ""
    render()
  }

  const section = (title, icon, body, action = "") => `
    <div class="section">
      <div class="section-head"><span>${icon}</span><h3>${title}</h3>${action ? `<div style="margin-left:auto">${action}</div>` : ""}</div>
      <div class="section-body">${body}</div>
    </div>`

  const kv = (pairs) => `<div class="kv-grid">${pairs.map(([k, v]) => `
    <div><p class="kv-k">${k}</p><p class="kv-v">${esc(v)}</p></div>`).join("")}</div>`

  const btnNuevo = (id, label) => `<button type="button" class="btn btn-soft" id="${id}">${PLUS}${label}</button>`
  const decimalValido = (v) => v === "" || /^\d*\.?\d{0,2}$/.test(v)

  // ── Paso 1: Cliente ────────────────────────────────────────────────
  function clientesFiltrados() {
    if (state.clientes === null) return []
    const q = norm(state.qCliente.trim())
    if (!q) return state.clientes
    return state.clientes.filter((c) => {
      const placas = vehiculosDe(c.rfc).map((v) => v.placas).join(" ")
      return norm(`${nombreCliente(c)} ${c.rfc} ${c.telefono || ""} ${placas}`).includes(q)
    })
  }

  function listaClientes() {
    if (state.clientes === null) return '<p class="t-center muted">Cargando clientes...</p>'
    const f = clientesFiltrados()
    if (f.length === 0) {
      return `<div class="empty-cta">
        <p>${state.clientes.length === 0 ? "Aún no hay clientes registrados." : `No hay clientes que coincidan con «${esc(state.qCliente)}».`}</p>
        <button type="button" class="btn btn-primary" data-nuevo-cliente style="box-shadow:none">${PLUS}Registrar cliente nuevo</button>
      </div>`
    }
    return `<div class="pick-list">${f.slice(0, 60).map((c) => {
      const n = vehiculosDe(c.rfc).length
      return `
        <button type="button" class="pick${state.cliente?.rfc === c.rfc ? " sel" : ""}" data-cliente="${esc(c.rfc)}">
          <div style="text-align:left">
            <p style="font-weight:600;font-size:0.92rem;color:var(--navy)">${esc(nombreCliente(c))}</p>
            <span class="mono muted" style="font-size:0.75rem">RFC: ${esc(c.rfc)}${c.telefono ? ` · Tel: ${esc(c.telefono)}` : ""}</span>
          </div>
          <div class="flex" style="align-items:center;gap:0.6rem">
            <span class="pill">${n} vehículo${plural(n)}</span>
            <div class="check">${ICON.check(12)}</div>
          </div>
        </button>`
    }).join("")}
      ${f.length > 60 ? `<p class="muted t-center" style="font-size:0.8rem">Mostrando 60 de ${f.length}. Escribe para filtrar.</p>` : ""}</div>`
  }

  function pasoCliente() {
    return section("Seleccionar Cliente", sym("user", 18, "var(--navy)"), `
      <div class="search full" style="margin-bottom:1.25rem">${SEARCH_ICON}
        <input type="search" id="q-cliente" data-search autocomplete="off" placeholder="Buscar por nombre, RFC, teléfono o placas..." value="${esc(state.qCliente)}">
      </div>
      <div id="clientes-list">${listaClientes()}</div>`, btnNuevo("btn-nuevo-cliente", "Nuevo cliente"))
  }

  // ── Paso 2: Vehículo ───────────────────────────────────────────────
  function pasoVehiculo() {
    const lista = vehiculosDe(state.cliente.rfc)
    const tarjetas = lista.map((v) => `
      <button type="button" class="pick${state.vehiculo?.id_vehiculo === v.id_vehiculo ? " sel" : ""}" data-vehiculo="${v.id_vehiculo}">
        <div class="top">
          <div style="text-align:left">
            <p style="font-weight:700;font-size:0.95rem;color:var(--navy)">${esc(v.marca || "")} ${esc(v.modelo)}</p>
            <p class="muted" style="font-size:0.78rem;margin-top:0.15rem">${esc(v.anio)} · ${esc(v.color || "—")}</p>
          </div>
          <div class="check">${ICON.check(11)}</div>
        </div>
        <div style="margin-top:0.75rem;text-align:left"><span class="plate">${esc(v.placas)}</span></div>
      </button>`).join("")
    const nuevo = `
      <button type="button" class="pick pick-new" data-nuevo-vehiculo>
        ${PLUS}<span>Registrar vehículo nuevo</span>
      </button>`
    return section(`Vehículos de ${esc(state.cliente.nombre)}`, sym("car", 18, "var(--navy)"), `
      ${lista.length === 0 ? '<p class="muted" style="margin-bottom:1rem">Este cliente aún no tiene vehículos. Regístralo aquí:</p>' : ""}
      <div class="pick-grid">${tarjetas}${nuevo}</div>`)
      + section("Historial del cliente", sym("clock", 18, "var(--navy)"), `<div id="historial-box">${historialHtml()}</div>`)
  }

  // ── Paso 3: Trabajo (tipo de orden, piezas, mano de obra y extras) ─
  /** ¿Se captura precio para la pieza nueva? Particular siempre; en seguro solo si es extra o la consigue el taller. */
  const llevaPrecio = (p) => !esSeguro() || p.es_extra || p.origen === "taller"

  function seccionTipo() {
    const segBtn = (v, l) => `<button type="button" class="seg-btn${state.tipo === v ? " on" : ""}" data-tipo="${v}">${l}</button>`
    const opts = state.aseguradoras.map((a) => `<option value="${esc(a)}"${state.aseguradora === a ? " selected" : ""}>${esc(a)}</option>`).join("")
    return section("Tipo de orden", sym("note", 18, "var(--navy)"), `
      <div class="seg seg-lg" role="group" aria-label="Tipo de orden">${segBtn("seguro", "Seguro")}${segBtn("particular", "Particular")}</div>
      <p class="muted" style="font-size:0.78rem;margin-top:0.5rem">${esSeguro()
        ? "Al cliente se le cobra el deducible y los extras que pida."
        : "El taller consigue las piezas; al cliente se le cobra todo: piezas, mano de obra y extras."}</p>
      ${esSeguro() ? `
      <div class="form-grid3" style="margin-top:1rem">
        <div class="field"><label class="label" for="f-aseg">Aseguradora *</label>
          <select class="input" id="f-aseg" data-f="aseguradora" style="background:#fff">
            <option value="">Selecciona...</option>${opts}
          </select>
          ${state.aseguradoras.length === 0 ? '<p class="hint">No hay aseguradoras: agrégalas en Configuración.</p>' : ""}</div>
        <div class="field"><label class="label" for="f-sin">Número de siniestro</label>
          <input class="input" id="f-sin" data-f="siniestro" maxlength="40" value="${esc(state.siniestro)}" style="background:#fff" placeholder="Opcional"></div>
        <div class="field"><label class="label" for="f-ded">Deducible (IVA incluido)</label>
          <div class="money"><span>$</span><input class="input" id="f-ded" data-f="deducible" data-dec inputmode="decimal" placeholder="0.00" value="${esc(state.deducible)}" style="background:#fff"></div>
          <p class="hint">Se cobra tal cual, sin IVA ni descuento.</p></div>
      </div>` : ""}`)
  }

  function filaPieza(p) {
    const precio = p.precio_unitario !== null && p.precio_unitario !== ""
      ? money(Number(p.precio_unitario) * Number(p.cantidad))
      : `<span class="muted">${p.origen === "aseguradora" ? "La paga la aseguradora" : "Sin cargo"}</span>`
    return `
      <tr>
        <td style="font-weight:600;color:var(--navy)">${esc(p.nombre)} ${p.es_extra ? extraBadge() : ""}</td>
        <td>${ladoBadge(p.lado, true)}</td>
        ${esSeguro() ? `<td>${esc(ORIGEN_LABEL[p.origen] || p.origen)}</td>` : ""}
        <td style="text-align:center;font-weight:700">${esc(p.cantidad)}</td>
        <td>${precio}</td>
        <td><button type="button" class="x-btn" data-quitar-pieza="${esc(p.key)}" title="Quitar" aria-label="Quitar ${esc(p.nombre)}">×</button></td>
      </tr>`
  }

  function seccionPiezas() {
    const n = state.nuevaPieza
    const origen = n.origen || (esSeguro() ? "aseguradora" : "taller")
    const ladoOpts = Object.entries(LADO_LABELS).map(([v, l]) => `<option value="${v}"${n.lado === v ? " selected" : ""}>${l}</option>`).join("")
    const lista = state.piezas.length === 0
      ? '<p class="muted" style="font-size:0.82rem;margin-top:0.75rem">Aún no hay piezas. Si el trabajo es solo de reparación, puedes continuar sin piezas.</p>'
      : `<table class="table-light" style="margin-top:1rem">
          <thead><tr><th>Pieza</th><th>Lado</th>${esSeguro() ? "<th>La consigue</th>" : ""}<th>Cant.</th><th>Importe</th><th></th></tr></thead>
          <tbody>${state.piezas.map(filaPieza).join("")}</tbody>
        </table>`
    return section("Piezas a cambio", sym("wrench", 18, "var(--navy)"), `
      <div class="pieza-form">
        <div class="field" style="grid-column:span 2"><label class="label" for="np-nombre">Pieza</label>
          <input class="input" id="np-nombre" data-np="nombre" list="dl-piezas" maxlength="100" autocomplete="off" placeholder="Ej. Faro, defensa delantera..." value="${esc(n.nombre)}" style="background:#fff">
          <datalist id="dl-piezas"></datalist></div>
        <div class="field"><label class="label" for="np-lado">Lado</label>
          <select class="input" id="np-lado" data-np="lado" style="background:#fff">${ladoOpts}</select></div>
        ${esSeguro() ? `<div class="field"><label class="label" for="np-origen">La consigue</label>
          <select class="input" id="np-origen" data-np="origen" data-rerender style="background:#fff">
            <option value="aseguradora"${origen === "aseguradora" ? " selected" : ""}>Aseguradora</option>
            <option value="taller"${origen === "taller" ? " selected" : ""}>Taller</option>
          </select></div>` : ""}
        <div class="field"><label class="label" for="np-cant">Cant.</label>
          <input class="input" id="np-cant" data-np="cantidad" type="number" min="1" max="999" value="${esc(n.cantidad)}" style="background:#fff"></div>
        ${llevaPrecio({ ...n, origen }) ? `<div class="field"><label class="label" for="np-precio">Precio c/u</label>
          <div class="money"><span>$</span><input class="input" id="np-precio" data-np="precio" data-dec inputmode="decimal" placeholder="0.00" value="${esc(n.precio)}" style="background:#fff"></div></div>` : ""}
        <label class="check-line" style="grid-column:1/-1"><input type="checkbox" data-np="es_extra" data-rerender ${n.es_extra ? "checked" : ""}> Es un <b>extra</b> (lo pide el cliente aparte de lo autorizado)</label>
        <div style="grid-column:1/-1;display:flex;gap:0.75rem;align-items:center">
          <button type="button" class="btn btn-primary" id="btn-add-pieza" style="box-shadow:none">${PLUS}Agregar pieza</button>
          <span class="ferr" id="err-pieza"${state.errPieza ? "" : " hidden"}>${esc(state.errPieza)}</span>
        </div>
      </div>
      ${lista}`)
  }

  function seccionCargos() {
    const extras = state.cargos.filter((c) => c.tipo === "extra")
    return section(esSeguro() ? "Extras que pide el cliente" : "Mano de obra y extras", sym("cash", 18, "var(--navy)"), `
      ${esSeguro() ? "" : `<div class="field" style="max-width:260px">
        <label class="label" for="f-mo">Mano de obra</label>
        <div class="money"><span>$</span><input class="input" id="f-mo" data-f="manoObra" data-dec inputmode="decimal" placeholder="0.00" value="${esc(state.manoObra)}" style="background:#fff"></div>
      </div>`}
      <div class="pieza-form" style="grid-template-columns:2fr 1fr auto">
        <div class="field"><label class="label" for="ne-concepto">Extra</label>
          <input class="input" id="ne-concepto" data-ne="concepto" maxlength="150" placeholder="Ej. Pintura completa del vehículo" value="${esc(state.nuevoExtra.concepto)}" style="background:#fff"></div>
        <div class="field"><label class="label" for="ne-monto">Monto</label>
          <div class="money"><span>$</span><input class="input" id="ne-monto" data-ne="monto" data-dec inputmode="decimal" placeholder="0.00" value="${esc(state.nuevoExtra.monto)}" style="background:#fff"></div></div>
        <div class="field" style="display:flex;align-items:flex-end"><button type="button" class="btn btn-soft" id="btn-add-extra">${PLUS}Agregar extra</button></div>
      </div>
      ${extras.length ? `<div style="margin-top:0.75rem">${extras.map((c) => `
        <div class="sum-row"><span>${extraBadge()} ${esc(c.concepto)}</span>
          <span class="flex" style="gap:0.4rem;align-items:center">${money(c.monto)}<button type="button" class="x-btn" data-quitar-cargo="${esc(c.key)}" aria-label="Quitar ${esc(c.concepto)}">×</button></span></div>`).join("")}</div>` : ""}`)
  }

  function pasoTrabajo() {
    return seccionTipo() + seccionPiezas() + seccionCargos()
      + section("Kilometraje y observaciones", sym("note", 18, "var(--navy)"), `
        <div class="field" style="max-width:260px">
          <label class="label" for="km-input">Kilometraje actual</label>
          <input class="input" id="km-input" type="number" min="0" max="2000000" step="1" inputmode="numeric" placeholder="Ej. 85400" value="${esc(state.kilometraje)}" style="background:#fff">
          <p class="hint" id="km-hint">${esc(textoUltimoKm())}</p>
        </div>
        <label class="label" for="obs">Observaciones</label>
        <textarea class="input" id="obs" rows="3" maxlength="1000" placeholder="Daños, trabajos a realizar, notas para el mecánico..." style="background:#fff;line-height:1.6">${esc(state.observaciones)}</textarea>`)
  }

  function agregarPieza() {
    const n = state.nuevaPieza
    const origen = esSeguro() ? (n.origen || "aseguradora") : "taller"
    const nombre = n.nombre.trim()
    const cant = Math.trunc(Number(n.cantidad))
    const conPrecio = llevaPrecio({ ...n, origen })
    let err = ""
    if (!nombre) err = "Escribe el nombre de la pieza"
    else if (!(cant >= 1 && cant <= 999)) err = "Cantidad inválida"
    else if (conPrecio && n.precio === "" && (!esSeguro() || n.es_extra)) err = "Indica el precio"
    state.errPieza = err
    if (err) return render()
    state.piezas = [...state.piezas, {
      key: nuevaKey(), nombre, lado: n.lado, origen, cantidad: cant,
      precio_unitario: conPrecio && n.precio !== "" ? Number(n.precio) : null, es_extra: n.es_extra,
    }]
    state.nuevaPieza = { ...PIEZA_VACIA, origen: n.origen }
    render()
    $("#np-nombre")?.focus()
  }

  function agregarExtra() {
    const concepto = state.nuevoExtra.concepto.trim()
    const monto = Number(state.nuevoExtra.monto)
    if (!concepto || !(monto > 0)) {
      toast("Escribe el concepto y un monto mayor a cero", "error")
      return
    }
    state.cargos = [...state.cargos, { key: nuevaKey(), tipo: "extra", concepto, monto }]
    state.nuevoExtra = { concepto: "", monto: "" }
    render()
    $("#ne-concepto")?.focus()
  }

  /** Al cambiar de tipo, las piezas se ajustan igual que en el servidor. */
  function cambiarTipo(tipo) {
    if (tipo === state.tipo) return
    state.tipo = tipo
    if (tipo === "particular") {
      state.piezas = state.piezas.map((p) => (p.origen === "aseguradora" ? { ...p, origen: "taller" } : p))
      const sinPrecio = state.piezas.filter((p) => p.precio_unitario === null).length
      if (sinPrecio) toast(`${sinPrecio} pieza${plural(sinPrecio)} sin precio: quítala${plural(sinPrecio)} y vuelve a agregarla${plural(sinPrecio)} con precio`, "info")
    }
    state.nuevaPieza = { ...state.nuevaPieza, origen: "" }
    render()
  }

  // ── Paso 4: Confirmar ──────────────────────────────────────────────
  function desgloseHtml(k) {
    return `
      <div class="sum-row"><span>Piezas que paga el cliente</span><span>${money(k.piezas)}</span></div>
      ${esSeguro() ? "" : `<div class="sum-row"><span>Mano de obra</span><span>${money(k.manoObra)}</span></div>`}
      <div class="sum-row"><span>Extras</span><span>${money(k.extras)}</span></div>
      <div class="sum-row"><span>IVA (16%)</span><span>${money(k.iva)}</span></div>
      ${esSeguro() ? `<div class="sum-row"><span>Deducible (IVA incluido)</span><span>${money(k.deducible)}</span></div>` : ""}
      <div class="side-total"><span style="font-size:0.78rem;font-weight:700;letter-spacing:0.06em">A COBRAR (ESTIMADO)</span>
        <span style="font-size:1rem;font-weight:800;color:var(--red)">${money(k.total)}</span></div>`
  }

  function pasoConfirmar() {
    const c = state.cliente
    const v = state.vehiculo
    const editar = (paso) => `<button type="button" class="link-btn" data-goto="${paso}">Cambiar</button>`
    const extras = state.cargos.filter((x) => x.tipo === "extra")
    return (state.error ? `<div class="alert">${esc(state.error)}</div>` : "")
      + section("Cliente", sym("user", 18, "var(--navy)"), kv([
        ["Nombre", nombreCliente(c)], ["RFC", c.rfc], ["Teléfono", c.telefono || "—"], ["Correo", c.correo || "—"],
      ]), editar(1))
      + section("Vehículo", sym("car", 18, "var(--navy)"), kv([
        ["Marca y Modelo", `${v.marca || ""} ${v.modelo}`], ["Placas", v.placas], ["Año", v.anio], ["Kilometraje", km(state.kilometraje)],
      ]), editar(2))
      + section("Trabajo", sym("wrench", 18, "var(--navy)"), `
        ${kv(esSeguro()
          ? [["Tipo", "Seguro"], ["Aseguradora", state.aseguradora], ["Siniestro", state.siniestro || "—"], ["Deducible", money(parseFloat(state.deducible) || 0)]]
          : [["Tipo", "Particular"], ["Mano de obra", money(parseFloat(state.manoObra) || 0)]])}
        ${state.piezas.length ? `<table class="table-light" style="margin-top:1rem">
          <thead><tr><th>Pieza</th><th>Lado</th>${esSeguro() ? "<th>La consigue</th>" : ""}<th>Cant.</th><th>Importe</th><th></th></tr></thead>
          <tbody>${state.piezas.map(filaPieza).join("")}</tbody></table>` : '<p class="muted" style="margin-top:1rem">Sin piezas a cambio.</p>'}
        ${extras.length ? `<div style="margin-top:1rem">${extras.map((x) => `<div class="sum-row"><span>${extraBadge()} ${esc(x.concepto)}</span><span>${money(x.monto)}</span></div>`).join("")}</div>` : ""}
        ${state.observaciones ? `<div style="margin-top:1rem;padding:0.875rem;background:#F9FAFB;border-radius:8px;border:1px solid var(--border)">
          <p class="kv-k" style="margin-bottom:0.3rem">Observaciones</p>
          <p style="font-size:0.88rem;color:var(--navy);line-height:1.6;white-space:pre-wrap">${esc(state.observaciones)}</p></div>` : ""}
        <div style="margin-top:1rem">${desgloseHtml(cobro())}</div>`, editar(3))
      + (esSeguro() ? "" : `<div class="cot-cta">
          <div><p style="font-weight:600;color:var(--navy);font-size:0.88rem">¿El cliente todavía no aprueba?</p>
            <p class="muted" style="font-size:0.78rem">Guárdala como cotización: puedes imprimirla o convertirla en orden después.</p></div>
          <button type="button" class="btn btn-outline" id="btn-cotizar" ${state.saving ? "disabled" : ""}>${sym("note", 16)}GUARDAR COMO COTIZACIÓN</button>
        </div>`)
  }

  // ── Renderizado general ────────────────────────────────────────────
  function renderSteps() {
    const max = maxPaso()
    $("#steps").innerHTML = STEPS.map((label, i) => {
      const num = i + 1
      const cls = state.step > num ? "done" : state.step === num ? "cur" : ""
      const last = i === STEPS.length - 1
      const alcanzable = num <= max && num !== state.step
      return `
        <div class="step ${cls}${last ? "" : " grow"}">
          <button type="button" class="step-col${alcanzable ? " clickable" : ""}" data-goto="${num}" ${alcanzable ? "" : "tabindex=\"-1\""}>
            <div class="step-dot">${state.step > num ? ICON.check(16).replace('stroke="white"', 'stroke="currentColor"') : num}</div>
            <span class="step-lbl">${label}</span>
          </button>
          ${last ? "" : '<div class="step-line"></div>'}
        </div>`
    }).join("")
  }

  function renderSide() {
    const c = state.cliente
    const v = state.vehiculo
    const n = state.piezas.length
    $("#side-summary").innerHTML = `
      <div class="side-block"><p class="side-k">Cliente</p>
        ${c ? `<p class="p-main">${esc(c.nombre)} ${esc(c.apellido_paterno)}</p>${c.telefono ? `<p class="p-sub">${esc(c.telefono)}</p>` : ""}` : '<p class="side-empty">Sin seleccionar</p>'}</div>
      <div class="side-block"><p class="side-k">Vehículo</p>
        ${v ? `<p class="p-main">${esc(v.marca || "")} ${esc(v.modelo)}</p><p class="p-sub mono">${esc(v.placas)}</p>` : '<p class="side-empty">Sin seleccionar</p>'}</div>
      <div class="side-block"><p class="side-k">Tipo</p>
        <p class="p-main">${esc(TIPO_ORDEN_LABEL[state.tipo])}${esSeguro() && state.aseguradora ? ` · ${esc(state.aseguradora)}` : ""}</p></div>
      <div class="side-block"><p class="side-k" style="margin-bottom:0.5rem">Piezas (${n})</p>
        ${n === 0 ? '<p class="side-empty">Sin piezas</p>' : state.piezas.map((p) => `
          <div class="side-line"><span>${esc(p.nombre)}${Number(p.cantidad) > 1 ? ` ×${esc(p.cantidad)}` : ""}</span>
            <span>${p.precio_unitario !== null ? money(p.precio_unitario * p.cantidad) : '<span class="muted">—</span>'}</span></div>`).join("")}
      </div>
      ${state.cliente && state.vehiculo ? `<div class="side-block">${desgloseHtml(cobro())}</div>` : ""}`
  }

  function renderNav() {
    const prev = $("#btn-prev")
    const next = $("#btn-next")
    prev.disabled = state.step === 1
    prev.style.visibility = state.step === 1 ? "hidden" : ""
    if (state.step < 4) {
      next.innerHTML = `Siguiente${ARROW_R}`
      next.disabled = !canNext()
      next.classList.toggle("btn-disabled-soft", !canNext())
      $("#nav-hint").textContent = canNext() ? "Ctrl + Enter para continuar" : (state.step === 3 && esSeguro() ? "Selecciona la aseguradora" : "")
    } else {
      next.classList.remove("btn-disabled-soft")
      next.disabled = state.saving
      next.innerHTML = state.saving ? '<span class="spinner sm"></span>GENERANDO...' : `${CHECK}GENERAR ORDEN`
      $("#nav-hint").textContent = "Ctrl + Enter para generar"
    }
  }

  function render() {
    renderSteps()
    const html = { 1: pasoCliente, 2: pasoVehiculo, 3: pasoTrabajo, 4: pasoConfirmar }[state.step]()
    $("#step-content").innerHTML = html
    renderSide()
    renderNav()
    bindStep()
    guardarBorrador()
  }

  /** Refresca resumen y navegación sin redibujar el paso (no se pierde el foco). */
  function refrescarLateral() {
    renderSide()
    renderNav()
    renderSteps()
    guardarBorrador()
  }

  // ── Acciones ───────────────────────────────────────────────────────
  function seleccionarCliente(c) {
    const cambio = state.cliente?.rfc !== c.rfc
    state.cliente = c
    if (cambio) {
      state.vehiculo = null
      cargarHistorial(c.rfc)
    }
    const suyos = vehiculosDe(c.rfc)
    if (!state.vehiculo && suyos.length === 1) state.vehiculo = suyos[0] // único vehículo: se preselecciona
    irA(2)
  }

  function seleccionarVehiculo(v) {
    state.vehiculo = v
    irA(3)
  }

  function nuevoCliente() {
    Forms.cliente({
      existentes: state.clientes || [],
      onSaved: (c) => {
        state.clientes = [...state.clientes, c].sort((a, b) => a.nombre.localeCompare(b.nombre))
        state.qCliente = ""
        seleccionarCliente(c)
      },
    })
  }

  function nuevoVehiculo() {
    Forms.vehiculo({
      clientes: state.clientes,
      rfcFijo: state.cliente.rfc,
      onSaved: (v) => {
        const nuevo = { ...v, rfc_cliente: state.cliente.rfc }
        state.vehiculos = [...state.vehiculos, nuevo]
        seleccionarVehiculo(nuevo)
      },
    })
  }

  const piezaParaEnviar = (p) => ({
    nombre: p.nombre, lado: p.lado, origen: p.origen, cantidad: Number(p.cantidad),
    precio_unitario: p.precio_unitario, es_extra: !!p.es_extra,
  })

  /** Datos que se envían al servidor para crear la orden. */
  const cuerpoOrden = () => ({
    id_vehiculo: state.vehiculo.id_vehiculo,
    rfc_cliente: state.cliente.rfc,
    observaciones: state.observaciones,
    kilometraje: state.kilometraje === "" ? null : Number(state.kilometraje),
    tipo: state.tipo,
    aseguradora: esSeguro() ? state.aseguradora : null,
    num_siniestro: esSeguro() ? state.siniestro : null,
    deducible: esSeguro() ? parseFloat(state.deducible) || 0 : 0,
    piezas: state.piezas.map(piezaParaEnviar),
    cargos: cargosFinales().map(({ tipo, concepto, monto }) => ({ tipo, concepto, monto })),
  })

  /** Cotización (siempre particular): piezas, mano de obra y extras como conceptos con precio. */
  const cuerpoCotizacion = () => ({
    id_vehiculo: state.vehiculo.id_vehiculo,
    rfc_cliente: state.cliente.rfc,
    observaciones: state.observaciones,
    kilometraje: state.kilometraje === "" ? null : Number(state.kilometraje),
    conceptos: [
      ...state.piezas.map((p) => ({ tipo: "pieza", concepto: p.es_extra ? `EXTRA · ${p.nombre}` : p.nombre, lado: p.lado, cantidad: Number(p.cantidad), precio_unitario: p.precio_unitario })),
      ...cargosFinales().map((c) => ({ tipo: c.tipo, concepto: c.concepto, cantidad: 1, precio_unitario: c.monto })),
    ],
  })

  async function guardarCotizacion() {
    if (state.saving) return
    state.saving = true
    state.error = ""
    render()
    try {
      const { ok, data } = await api("api/cotizaciones.php", { method: "POST", body: cuerpoCotizacion() })
      if (ok) {
        sessionStorage.removeItem(DRAFT_KEY)
        return mostrarExitoCotizacion(data.id_cotizacion)
      }
      state.error = data.error || "Error al guardar la cotización"
    } catch {
      state.error = "Error de conexión"
    }
    state.saving = false
    render()
  }

  function mostrarExitoCotizacion(id) {
    $("#wizard-root").innerHTML = `
      <div class="center-screen">
        <div class="success-box">
          <div class="success-ico">${sym("note", 34, "#16A34A")}</div>
          <h2>¡Cotización #${pad4(id)} guardada!</h2>
          <p class="muted">${esc(nombreCliente(state.cliente))} · ${esc(state.vehiculo.placas)} · ${money(cobro().total)}</p>
          <div class="flex" style="gap:0.75rem;margin-top:1.75rem;justify-content:center;flex-wrap:wrap">
            <a href="cotizacion_imprimir.php?id=${id}" class="btn btn-primary" id="btn-imp-cot" style="padding:0.85rem 1.5rem;border-radius:12px">IMPRIMIR COTIZACIÓN</a>
            <a href="cotizaciones.php" class="btn btn-outline" style="padding:0.85rem 1.5rem;border-radius:12px">VER COTIZACIONES</a>
            <a href="orden_nueva.php" class="btn btn-outline" style="padding:0.85rem 1.5rem;border-radius:12px">${PLUS}NUEVA ORDEN</a>
          </div>
        </div>
      </div>`
    $("#btn-imp-cot").focus()
  }

  async function generar() {
    if (state.saving) return
    state.saving = true
    state.error = ""
    renderNav()
    try {
      const { ok, data } = await api("api/ordenes.php", { method: "POST", body: cuerpoOrden() })
      if (ok) {
        sessionStorage.removeItem(DRAFT_KEY)
        return mostrarExito(data.id_orden)
      }
      state.error = data.error || "Error al generar la orden"
    } catch {
      state.error = "Error de conexión"
    }
    state.saving = false
    render()
  }

  function mostrarExito(idOrden) {
    const n = state.piezas.length
    $("#wizard-root").innerHTML = `
      <div class="center-screen">
        <div class="success-box">
          <div class="success-ico"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
          <h2>¡Orden #${pad4(idOrden)} generada!</h2>
          <p class="muted">${esc(nombreCliente(state.cliente))} · ${esc(state.vehiculo.placas)} · ${esc(TIPO_ORDEN_LABEL[state.tipo])} · ${n} pieza${plural(n)}</p>
          <div class="flex" style="gap:0.75rem;margin-top:1.75rem;justify-content:center;flex-wrap:wrap">
            <a href="ordenes.php?id=${idOrden}" class="btn btn-primary" id="btn-ver-orden" style="padding:0.85rem 1.5rem;border-radius:12px">VER ORDEN</a>
            <a href="orden_nueva.php" class="btn btn-outline" style="padding:0.85rem 1.5rem;border-radius:12px">${PLUS}NUEVA ORDEN</a>
            <a href="ordenes.php" class="btn btn-outline" style="padding:0.85rem 1.5rem;border-radius:12px">VER ÓRDENES</a>
          </div>
        </div>
      </div>`
    $("#btn-ver-orden").focus()
  }

  // ── Eventos ────────────────────────────────────────────────────────
  const sugerir = debounce(async (texto) => {
    const dl = $("#dl-piezas")
    if (!dl || texto.trim().length < 2) return
    const { ok, data } = await api(`api/piezas.php?sugerir=${encodeURIComponent(texto)}`)
    if (ok && Array.isArray(data) && $("#dl-piezas")) $("#dl-piezas").innerHTML = data.map((n) => `<option value="${esc(n)}">`).join("")
  }, 250)

  function bindStep() {
    const qc = $("#q-cliente")
    if (qc) {
      qc.addEventListener("input", debounce(() => {
        state.qCliente = qc.value
        $("#clientes-list").innerHTML = listaClientes()
      }, 120))
      qc.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.ctrlKey || state.clientes === null) return
        const f = clientesFiltrados()
        if (f.length === 1) seleccionarCliente(f[0])
        else if (f.length === 0) nuevoCliente()
      })
      if (!state.cliente) qc.focus()
    }
    const obs = $("#obs")
    if (obs) obs.addEventListener("input", () => { state.observaciones = obs.value; guardarBorrador() })
    const kmIn = $("#km-input")
    if (kmIn) {
      kmIn.addEventListener("input", () => {
        kmIn.value = kmIn.value.replace(/\D/g, "").slice(0, 7)
        state.kilometraje = kmIn.value
        const u = ultimoKm()
        kmIn.classList.toggle("err", u !== null && state.kilometraje !== "" && Number(state.kilometraje) < u)
        $("#km-hint").textContent = u !== null && state.kilometraje !== "" && Number(state.kilometraje) < u
          ? `Ojo: es menor al último registrado (${km(u)})` : textoUltimoKm()
        guardarBorrador()
      })
    }
    $("#np-nombre")?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.ctrlKey) { e.preventDefault(); agregarPieza() } })
    $("#np-precio")?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.ctrlKey) { e.preventDefault(); agregarPieza() } })
    $("#ne-monto")?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.ctrlKey) { e.preventDefault(); agregarExtra() } })
  }

  const root = $("#wizard-root")

  /** Campos con data-f (datos de la orden), data-np (pieza nueva) y data-ne (extra nuevo). */
  root.addEventListener("input", (e) => {
    const t = e.target
    if (t.hasAttribute("data-dec") && !decimalValido(t.value)) {
      t.value = t.value.replace(/[^\d.]/g, "").replace(/(\.\d{0,2}).*/, "$1")
    }
    if (t.dataset.f) {
      state[t.dataset.f] = t.value
      return refrescarLateral()
    }
    if (t.dataset.np && t.type !== "checkbox") {
      state.nuevaPieza = { ...state.nuevaPieza, [t.dataset.np]: t.value }
      if (t.dataset.np === "nombre") sugerir(t.value)
      return
    }
    if (t.dataset.ne) state.nuevoExtra = { ...state.nuevoExtra, [t.dataset.ne]: t.value }
  })

  root.addEventListener("change", (e) => {
    const t = e.target
    if (t.dataset.np) {
      state.nuevaPieza = { ...state.nuevaPieza, [t.dataset.np]: t.type === "checkbox" ? t.checked : t.value }
      if (t.hasAttribute("data-rerender")) render()
    }
    if (t.dataset.f === "aseguradora") render()
  })

  root.addEventListener("click", (e) => {
    const t = e.target
    const go = t.closest("[data-goto]")
    if (go) return irA(Number(go.dataset.goto))
    if (t.closest("#btn-nuevo-cliente, [data-nuevo-cliente]")) return nuevoCliente()
    if (t.closest("[data-nuevo-vehiculo]")) return nuevoVehiculo()
    const pc = t.closest("[data-cliente]")
    if (pc) return seleccionarCliente(state.clientes.find((c) => c.rfc === pc.dataset.cliente))
    const pv = t.closest("[data-vehiculo]")
    if (pv) return seleccionarVehiculo(state.vehiculos.find((v) => v.id_vehiculo === Number(pv.dataset.vehiculo)))
    const tb = t.closest("[data-tipo]")
    if (tb) return cambiarTipo(tb.dataset.tipo)
    if (t.closest("#btn-add-pieza")) return agregarPieza()
    if (t.closest("#btn-add-extra")) return agregarExtra()
    if (t.closest("#btn-cotizar")) return guardarCotizacion()
    const qp = t.closest("[data-quitar-pieza]")
    if (qp) {
      state.piezas = state.piezas.filter((p) => p.key !== qp.dataset.quitarPieza)
      return render()
    }
    const qx = t.closest("[data-quitar-cargo]")
    if (qx) {
      state.cargos = state.cargos.filter((c) => c.key !== qx.dataset.quitarCargo)
      return render()
    }
  })

  $("#btn-prev").addEventListener("click", () => irA(state.step - 1))
  $("#btn-next").addEventListener("click", () => (state.step < 4 ? irA(state.step + 1) : generar()))
  $("#btn-reset").addEventListener("click", () => {
    confirmDialog({
      icon: ICON.xCircle(24, "var(--red)"),
      title: "¿Empezar de nuevo?",
      detail: '<p class="m">Se descartará lo capturado.</p>',
      note: "No se guardó ninguna orden todavía.",
      okText: "DESCARTAR",
      busyText: "DESCARTANDO...",
      onConfirm: async () => {
        sessionStorage.removeItem(DRAFT_KEY)
        Object.assign(state, {
          step: 1, cliente: null, vehiculo: null, tipo: "seguro", aseguradora: "", siniestro: "", deducible: "",
          piezas: [], cargos: [], nuevaPieza: { ...PIEZA_VACIA }, nuevoExtra: { concepto: "", monto: "" }, manoObra: "",
          observaciones: "", kilometraje: "", historial: null, qCliente: "", error: "", errPieza: "",
        })
        render()
        return null
      },
    })
  })

  // Ctrl+Enter: siguiente paso / generar
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey) || $(".overlay")) return
    e.preventDefault()
    $("#btn-next")?.click()
  })

  // ── Carga inicial ──────────────────────────────────────────────────
  render()
  Promise.all([api("api/clientes.php"), api("api/vehiculos.php"), api("api/configuracion.php")]).then(([c, v, cfg]) => {
    state.clientes = c.ok && Array.isArray(c.data) ? c.data : []
    state.vehiculos = v.ok && Array.isArray(v.data) ? v.data : []
    state.aseguradoras = cfg.ok && Array.isArray(cfg.data?.aseguradoras) ? cfg.data.aseguradoras : []
    restaurarBorrador()
    render()
  }).catch(() => {
    $("#step-content").innerHTML = '<div class="alert">No se pudieron cargar los datos. Revisa que MySQL esté encendido y recarga la página.</div>'
  })
})()
