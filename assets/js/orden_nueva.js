"use strict"

;(() => {
  const STEPS = ["Cliente", "Vehículo", "Trabajo", "Confirmar"]
  const DRAFT_KEY = "ordenBorrador2"
  const SEARCH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
  const ARROW_R = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'
  const CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
  const PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'

  const PIEZA_VACIA = { nombre: "", lado: "NA", origen: "", cantidad: "1", precio: "" }
  const SINIESTRO_MIN = 12
  const SINIESTRO_MAX = 16
  const limpiarSiniestro = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, SINIESTRO_MAX)

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
    catalogo: null,          // {marcas, piezas} para el selector de piezas
    qCliente: "",
    saving: false,
    error: "",
    errPieza: "",
    ultimaPieza: null,       // key de la pieza recién agregada (se resalta en el lateral)
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
    state.siniestro = limpiarSiniestro(d.siniestro)
    state.deducible = d.deducible || ""
    state.piezas = Array.isArray(d.piezas) ? d.piezas.map((p) => ({ ...p, es_extra: false })) : []
    state.cargos = Array.isArray(d.cargos) ? d.cargos : []
    state.manoObra = d.manoObra || ""
    if (esSeguro()) { // seguro: sin cobros aparte
      state.piezas = state.piezas.map((p) => ({ ...p, precio_unitario: null }))
      state.cargos = []
      state.manoObra = ""
    }
    state.observaciones = d.obs || ""
    state.kilometraje = d.km || ""
    if (state.cliente) cargarHistorial(state.cliente.rfc)
    const f = faltante(d.step || 1)
    state.step = f ? f.paso : d.step || 1
    if (state.cliente) toast("Se recuperó la orden que tenías en progreso", "info")
  }

  // ── Utilidades ─────────────────────────────────────────────────────
  const vehiculosDe = (rfc) => (state.vehiculos || []).filter((v) => v.rfc_cliente === rfc)
  const esSeguro = () => state.tipo === "seguro"

  /** Cargos que se enviarán (mano de obra solo en particular). */
  function cargosFinales() {
    if (esSeguro()) return []
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

  function errorSiniestro(v) {
    const s = limpiarSiniestro(v)
    if (!s) return "Escribe el número de siniestro (es obligatorio)"
    if (s.length < SINIESTRO_MIN) return `Al número de siniestro le faltan ${SINIESTRO_MIN - s.length} caracteres (lleva de ${SINIESTRO_MIN} a ${SINIESTRO_MAX})`
    return null
  }
  /** ¿Quedó algo escrito en el formulario de pieza sin darle «Agregar»? */
  const piezaSinAgregar = () => !!state.nuevaPieza.nombre || (!esSeguro() && state.nuevaPieza.precio !== "")
  const extraSinAgregar = () => !esSeguro() && (state.nuevoExtra.concepto.trim() !== "" || state.nuevoExtra.monto !== "")

  /**
   * Primer dato que falta para poder llegar al paso `hasta` (o generar, con 5).
   * @returns {{paso:number, sel:string, msg:string}|null}
   */
  function faltante(hasta) {
    if (hasta > 1 && !state.cliente) return { paso: 1, sel: "#q-cliente", msg: "Primero selecciona o registra al cliente" }
    if (hasta > 2 && !state.vehiculo) return { paso: 2, sel: ".pick-grid", msg: "Selecciona o registra el vehículo" }
    if (hasta > 3) {
      if (esSeguro()) {
        if (!state.aseguradora) return { paso: 3, sel: "#f-aseg", msg: state.aseguradoras.length ? "Selecciona la aseguradora" : "No hay aseguradoras registradas: agrégalas en Configuración" }
        const e = errorSiniestro(state.siniestro)
        if (e) return { paso: 3, sel: "#f-sin", msg: e }
      }
      if (piezaSinAgregar()) return { paso: 3, sel: "#btn-add-pieza", msg: "Escribiste una pieza pero no la agregaste: da clic en «Agregar pieza» o bórrala" }
      if (extraSinAgregar()) return { paso: 3, sel: "#btn-add-extra", msg: "Escribiste un extra pero no lo agregaste: da clic en «Agregar extra» o bórralo" }
      if (!esSeguro()) {
        const sinPrecio = state.piezas.find((p) => p.precio_unitario === null || p.precio_unitario === "")
        if (sinPrecio) return { paso: 3, sel: `[data-precio-pieza="${sinPrecio.key}"]`, msg: `Indica el precio de «${sinPrecio.nombre}»` }
        if (cobro().total <= 0) return { paso: 3, sel: "#np-nombre", msg: "La orden particular no tiene nada que cobrar: agrega piezas con precio, mano de obra o extras" }
      }
    }
    return null
  }

  /** Resalta un campo que falta, lo muestra y le pone el foco. */
  function marcarFalta(sel) {
    const el = $(sel)
    if (!el) return
    el.classList.add("falta")
    el.scrollIntoView({ block: "center", behavior: "smooth" })
    if (el.matches("input, select, textarea, button")) el.focus({ preventScroll: true })
    setTimeout(() => el.classList.remove("falta"), 2600)
  }

  /** Lleva al usuario al dato que falta, con advertencia. */
  function mandarAFaltante(f) {
    toast(f.msg, "error")
    state.step = f.paso
    state.error = ""
    render()
    marcarFalta(f.sel)
  }

  function irA(paso) {
    if (paso < 1 || paso > 4 || paso === state.step) return
    const f = paso > state.step ? faltante(paso) : null
    if (f) return mandarAFaltante(f)
    state.step = paso
    state.error = ""
    render()
    window.scrollTo({ top: 0 })
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
  /** En seguro al cliente solo se le cobra el deducible: las piezas no llevan precio. */
  const llevaPrecio = () => !esSeguro()

  function seccionTipo() {
    const card = (v, t, d) => `<button type="button" class="tipo-card${state.tipo === v ? " on" : ""}" data-tipo="${v}" aria-pressed="${state.tipo === v}">
      <span class="t">${t}</span><span class="d">${d}</span></button>`
    const opts = state.aseguradoras.map((a) => `<option value="${esc(a)}"${state.aseguradora === a ? " selected" : ""}>${esc(a)}</option>`).join("")
    const nSin = limpiarSiniestro(state.siniestro).length
    return section("Tipo de orden", sym("note", 18, "var(--navy)"), `
      <div class="tipo-picker" role="group" aria-label="Tipo de orden">
        ${card("seguro", "SEGURO", "Lo autoriza la aseguradora. Al cliente solo se le cobra el deducible.")}
        ${card("particular", "PARTICULAR", "Lo paga el cliente: piezas, mano de obra y extras.")}
      </div>
      ${esSeguro() ? `
      <div class="seguro-box">
        <div class="form-grid3">
          <div class="field field-key"><label class="label" for="f-aseg">Aseguradora *</label>
            <select class="input input-lg" id="f-aseg" data-f="aseguradora" style="background:#fff">
              <option value="">Selecciona...</option>${opts}
            </select>
            ${state.aseguradoras.length === 0 ? '<p class="hint warn">No hay aseguradoras: agrégalas en Configuración.</p>' : ""}</div>
          <div class="field field-key"><label class="label" for="f-sin">Número de siniestro *</label>
            <input class="input mono input-lg" id="f-sin" data-f="siniestro" maxlength="${SINIESTRO_MAX}" autocomplete="off" spellcheck="false" value="${esc(state.siniestro)}" style="background:#fff" placeholder="Letras y números">
            <p class="hint${nSin >= SINIESTRO_MIN ? " ok" : ""}" id="sin-hint">${textoSiniestro(nSin)}</p></div>
          <div class="field field-key"><label class="label" for="f-ded">Deducible (IVA incluido)</label>
            <div class="money"><span>$</span><input class="input input-lg" id="f-ded" data-f="deducible" data-dec inputmode="decimal" placeholder="0.00" value="${esc(state.deducible)}" style="background:#fff"></div>
            <p class="hint">Es lo único que paga el cliente.</p></div>
        </div>
        <p class="muted" style="font-size:0.8rem;margin-top:0.6rem">Si el cliente quiere algo extra (pintura completa, otra pieza...), se hace en una <b>orden particular</b> aparte.</p>
      </div>` : ""}`)
  }
  const textoSiniestro = (n) => (n === 0
    ? `Obligatorio · de ${SINIESTRO_MIN} a ${SINIESTRO_MAX} letras y números`
    : `${n}/${SINIESTRO_MAX}${n < SINIESTRO_MIN ? ` · faltan ${SINIESTRO_MIN - n} como mínimo` : " ✓"}`)

  function filaPieza(p, editable = true) {
    const conPrecio = p.precio_unitario !== null && p.precio_unitario !== ""
    const precio = conPrecio
      ? money(Number(p.precio_unitario) * Number(p.cantidad))
      : esSeguro() ? '<span class="muted">Sin cargo al cliente</span>'
      : editable ? `<div class="money" style="max-width:140px"><span>$</span><input class="input" data-precio-pieza="${esc(p.key)}" data-dec inputmode="decimal" placeholder="Precio c/u" style="background:#fff"></div>`
      : '<b class="text-red">Falta precio</b>'
    return `
      <tr>
        <td style="font-weight:600;color:var(--navy)">${esc(p.nombre)}</td>
        <td>${ladoBadge(p.lado, true)}</td>
        ${esSeguro() ? `<td>${esc(ORIGEN_LABEL[p.origen] || p.origen)}</td>` : ""}
        <td style="text-align:center;font-weight:700">${esc(p.cantidad)}</td>
        <td>${precio}</td>
        <td>${editable ? `<button type="button" class="x-btn" data-quitar-pieza="${esc(p.key)}" title="Quitar" aria-label="Quitar ${esc(p.nombre)}">×</button>` : ""}</td>
      </tr>`
  }

  function seccionPiezas() {
    const n = state.nuevaPieza
    const origen = n.origen || (esSeguro() ? "aseguradora" : "taller")
    const ladoOpts = Object.entries(LADO_LABELS).map(([v, l]) => `<option value="${v}"${n.lado === v ? " selected" : ""}>${l}</option>`).join("")
    const lista = `<p class="pz-aviso-lateral">${state.piezas.length === 0
      ? "Aún no hay piezas. Si el trabajo es solo de reparación, puedes continuar sin piezas."
      : `${state.piezas.length} pieza${plural(state.piezas.length)} en la orden`}
      <span class="pz-flecha">· aparecen en el resumen <b class="pz-dir"></b></span></p>`
    return section(`Piezas a cambio${state.piezas.length ? ` (${state.piezas.length})` : ""}`, sym("wrench", 18, "var(--navy)"), `
      <div class="pieza-form">
        <div class="field" style="grid-column:span 2"><label class="label" for="np-nombre">Pieza</label>
          <div id="np-nombre-host"></div></div>
        <div class="field"><label class="label" for="np-lado">Lado</label>
          <select class="input" id="np-lado" data-np="lado" style="background:#fff">${ladoOpts}</select></div>
        ${esSeguro() ? `<div class="field"><label class="label" for="np-origen">La consigue</label>
          <select class="input" id="np-origen" data-np="origen" data-rerender style="background:#fff">
            <option value="aseguradora"${origen === "aseguradora" ? " selected" : ""}>Aseguradora</option>
            <option value="taller"${origen === "taller" ? " selected" : ""}>Taller</option>
          </select></div>` : ""}
        <div class="field"><label class="label" for="np-cant">Cant.</label>
          <input class="input" id="np-cant" data-np="cantidad" type="number" min="1" max="999" value="${esc(n.cantidad)}" style="background:#fff"></div>
        ${llevaPrecio() ? `<div class="field"><label class="label" for="np-precio">Precio c/u *</label>
          <div class="money"><span>$</span><input class="input" id="np-precio" data-np="precio" data-dec inputmode="decimal" placeholder="0.00" value="${esc(n.precio)}" style="background:#fff"></div></div>` : ""}
        <div style="grid-column:1/-1;display:flex;gap:0.75rem;align-items:center">
          <button type="button" class="btn btn-primary" id="btn-add-pieza" style="box-shadow:none">${PLUS}Agregar pieza</button>
          <span class="ferr" id="err-pieza"${state.errPieza ? "" : " hidden"}>${esc(state.errPieza)}</span>
        </div>
      </div>
      ${lista}`)
  }

  function seccionCargos() {
    const extras = state.cargos.filter((c) => c.tipo === "extra")
    return section("Mano de obra y extras", sym("cash", 18, "var(--navy)"), `
      <div class="field" style="max-width:260px">
        <label class="label" for="f-mo">Mano de obra</label>
        <div class="money"><span>$</span><input class="input input-lg" id="f-mo" data-f="manoObra" data-dec inputmode="decimal" placeholder="0.00" value="${esc(state.manoObra)}" style="background:#fff"></div>
      </div>
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
    return seccionTipo() + seccionPiezas() + (esSeguro() ? "" : seccionCargos())
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
    let err = ""
    let sel = ""
    if (!nombre) [err, sel] = ["Elige la pieza de la lista (o agrégala si no existe)", "#np-nombre"]
    else if (!(cant >= 1 && cant <= 999)) [err, sel] = ["La cantidad debe ser de 1 a 999", "#np-cant"]
    else if (llevaPrecio() && !(Number(n.precio) > 0)) [err, sel] = ["Indica el precio de la pieza", "#np-precio"]
    state.errPieza = err
    if (err) {
      render()
      return marcarFalta(sel)
    }
    state.piezas = [...state.piezas, {
      key: nuevaKey(), nombre, lado: n.lado, origen, cantidad: cant,
      precio_unitario: llevaPrecio() ? Number(n.precio) : null, es_extra: false,
    }]
    state.ultimaPieza = state.piezas[state.piezas.length - 1].key
    state.nuevaPieza = { ...PIEZA_VACIA, origen: n.origen }
    render()
    $("#np-nombre")?.focus()
    const nueva = $(`[data-pz-card="${state.ultimaPieza}"]`)
    nueva?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    setTimeout(() => { state.ultimaPieza = null }, 1500)
  }

  function agregarExtra() {
    const concepto = state.nuevoExtra.concepto.trim()
    const monto = Number(state.nuevoExtra.monto)
    if (!concepto || !(monto > 0)) {
      toast(!concepto ? "Escribe en qué consiste el extra" : "El monto del extra debe ser mayor a cero", "error")
      return marcarFalta(!concepto ? "#ne-concepto" : "#ne-monto")
    }
    state.cargos = [...state.cargos, { key: nuevaKey(), tipo: "extra", concepto, monto }]
    state.nuevoExtra = { concepto: "", monto: "" }
    render()
    $("#ne-concepto")?.focus()
  }

  /** Al cambiar de tipo, las piezas se ajustan igual que en el servidor. */
  function cambiarTipo(tipo) {
    if (tipo === state.tipo) return
    if (tipo === "seguro") {
      const conPrecio = state.piezas.filter((p) => p.precio_unitario !== null).length
      const extras = state.cargos.length + (parseFloat(state.manoObra) > 0 ? 1 : 0)
      const aplicar = () => {
        state.tipo = "seguro"
        state.piezas = state.piezas.map((p) => ({ ...p, precio_unitario: null }))
        state.cargos = []
        state.manoObra = ""
        state.nuevoExtra = { concepto: "", monto: "" }
        state.nuevaPieza = { ...state.nuevaPieza, origen: "", precio: "" }
        render()
      }
      if (!conPrecio && !extras) return aplicar()
      return confirmDialog({
        icon: sym("note", 24, "var(--navy)"),
        title: "¿Cambiar a orden de seguro?",
        detail: `<p class="m">En seguro al cliente solo se le cobra el deducible. Se quitarán ${[
          conPrecio ? `los precios de ${conPrecio} pieza${plural(conPrecio)}` : "",
          extras ? "la mano de obra y los extras" : "",
        ].filter(Boolean).join(" y ")}.</p>`,
        note: "Si el cliente pide algo extra, haz después una orden particular.",
        okText: "SÍ, CAMBIAR",
        busyText: "CAMBIANDO...",
        okClass: "btn-primary",
        onConfirm: async () => { aplicar(); return null },
      })
    }
    state.tipo = "particular"
    state.piezas = state.piezas.map((p) => ({ ...p, origen: "taller" }))
    state.nuevaPieza = { ...state.nuevaPieza, origen: "" }
    render()
    const sinPrecio = state.piezas.filter((p) => p.precio_unitario === null).length
    if (sinPrecio) {
      toast(`Escribe el precio de ${sinPrecio} pieza${plural(sinPrecio)} en la tabla`, "info")
      marcarFalta("[data-precio-pieza]")
    }
  }

  // ── Paso 4: Confirmar ──────────────────────────────────────────────
  function desgloseHtml(k) {
    const total = `<div class="side-total-lg"><span class="k">A COBRAR AL CLIENTE</span><span class="v">${money(k.total)}</span></div>`
    if (esSeguro()) {
      return `<div class="sum-row"><span>Deducible (IVA incluido)</span><span>${money(k.deducible)}</span></div>${total}`
    }
    return `
      <div class="sum-row"><span>Piezas</span><span>${money(k.piezas)}</span></div>
      <div class="sum-row"><span>Mano de obra</span><span>${money(k.manoObra)}</span></div>
      <div class="sum-row"><span>Extras</span><span>${money(k.extras)}</span></div>
      <div class="sum-row"><span>IVA (16%)</span><span>${money(k.iva)}</span></div>
      ${total}`
  }

  function pasoConfirmar() {
    const c = state.cliente
    const v = state.vehiculo
    const editar = (paso) => `<button type="button" class="link-btn" data-goto="${paso}">Cambiar</button>`
    const extras = esSeguro() ? [] : state.cargos.filter((x) => x.tipo === "extra")
    return (state.error ? `<div class="alert">${esc(state.error)}</div>` : "")
      + section("Cliente", sym("user", 18, "var(--navy)"), kv([
        ["Nombre", nombreCliente(c)], ["RFC", c.rfc], ["Teléfono", c.telefono || "—"], ["Correo", c.correo || "—"],
      ]), editar(1))
      + section("Vehículo", sym("car", 18, "var(--navy)"), kv([
        ["Marca y Modelo", `${v.marca || ""} ${v.modelo}`], ["Placas", v.placas], ["Año", v.anio], ["Kilometraje", km(state.kilometraje)],
      ]), editar(2))
      + section("Trabajo", sym("wrench", 18, "var(--navy)"), `
        ${kv(esSeguro()
          ? [["Tipo", "Seguro"], ["Aseguradora", state.aseguradora], ["Siniestro", limpiarSiniestro(state.siniestro)], ["Deducible", money(parseFloat(state.deducible) || 0)]]
          : [["Tipo", "Particular"], ["Mano de obra", money(parseFloat(state.manoObra) || 0)]])}
        ${state.piezas.length ? `<table class="table-light" style="margin-top:1rem">
          <thead><tr><th>Pieza</th><th>Lado</th>${esSeguro() ? "<th>La consigue</th>" : ""}<th>Cant.</th><th>Importe</th><th></th></tr></thead>
          <tbody>${state.piezas.map((p) => filaPieza(p, false)).join("")}</tbody></table>` : '<p class="muted" style="margin-top:1rem">Sin piezas a cambio.</p>'}
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
    $("#steps").innerHTML = STEPS.map((label, i) => {
      const num = i + 1
      const cls = state.step > num ? "done" : state.step === num ? "cur" : ""
      const last = i === STEPS.length - 1
      const alcanzable = num !== state.step
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
    const scroll = $(".pz-side-list")?.scrollTop || 0
    $(".wizard").classList.toggle("con-piezas", state.step === 3)
    const c = state.cliente
    const v = state.vehiculo
    const n = state.piezas.length
    const compacto = state.step === 3 && c && v
    $("#side-summary").innerHTML = compacto ? `
      <div class="side-block side-compacto">
        <p class="p-main">${esc(c.nombre)} ${esc(c.apellido_paterno)}</p>
        <p class="p-sub" style="display:flex;gap:0.5rem;align-items:center;margin-top:0.3rem"><span class="plate">${esc(v.placas)}</span>${esc(v.marca || "")} ${esc(v.modelo)}</p>
        <p class="p-sub" style="margin-top:0.3rem">${esc(TIPO_ORDEN_LABEL[state.tipo])}${esSeguro() && state.aseguradora ? ` · ${esc(state.aseguradora)}` : ""}</p>
      </div>
      ${piezasLateral()}
      <div class="side-block" id="side-desglose">${desgloseHtml(cobro())}</div>` : `
      <div class="side-block"><p class="side-k">Cliente</p>
        ${c ? `<p class="p-main">${esc(c.nombre)} ${esc(c.apellido_paterno)}</p>${c.telefono ? `<p class="p-sub">${esc(c.telefono)}</p>` : ""}` : '<p class="side-empty">Sin seleccionar</p>'}</div>
      <div class="side-block"><p class="side-k">Vehículo</p>
        ${v ? `<p class="p-main">${esc(v.marca || "")} ${esc(v.modelo)} ${esc(v.anio)}</p><p style="margin-top:0.35rem"><span class="plate plate-lg">${esc(v.placas)}</span></p>` : '<p class="side-empty">Sin seleccionar</p>'}</div>
      <div class="side-block"><p class="side-k">Tipo</p>
        <p class="p-main">${esc(TIPO_ORDEN_LABEL[state.tipo])}${esSeguro() && state.aseguradora ? ` · ${esc(state.aseguradora)}` : ""}</p>
        ${esSeguro() && state.siniestro ? `<p class="p-sub mono">Siniestro: ${esc(limpiarSiniestro(state.siniestro))}</p>` : ""}</div>
      ${state.step === 3 ? piezasLateral() : `<div class="side-block"><p class="side-k" style="margin-bottom:0.5rem">Piezas (${n})</p>
        ${n === 0 ? '<p class="side-empty">Sin piezas</p>' : state.piezas.map((p) => `
          <div class="side-line"><span>${esc(p.nombre)}${Number(p.cantidad) > 1 ? ` ×${esc(p.cantidad)}` : ""}</span>
            <span>${p.precio_unitario !== null ? money(p.precio_unitario * p.cantidad) : '<span class="muted">—</span>'}</span></div>`).join("")}
      </div>`}
      ${state.cliente && state.vehiculo ? `<div class="side-block" id="side-desglose">${desgloseHtml(cobro())}</div>` : ""}`
    if (scroll) $(".pz-side-list").scrollTop = scroll
  }

  /** Piezas en el lateral (paso 3): cada una como tarjeta; la recién agregada entra animada. */
  function piezasLateral() {
    const n = state.piezas.length
    const tarjeta = (p) => {
      const sub = Number(p.precio_unitario) * Number(p.cantidad)
      return `
      <div class="pz-card${p.key === state.ultimaPieza ? " pz-nueva" : ""}" data-pz-card="${esc(p.key)}">
        <div class="pz-card-top">
          <p class="pz-card-n">${esc(p.nombre)}${Number(p.cantidad) > 1 ? ` <span class="pz-cant">×${esc(p.cantidad)}</span>` : ""}</p>
          <button type="button" class="x-btn" data-quitar-pieza="${esc(p.key)}" title="Quitar" aria-label="Quitar ${esc(p.nombre)}">×</button>
        </div>
        <p class="pz-card-meta">${ladoBadge(p.lado, true)}${esSeguro() ? ` <span>${esc(ORIGEN_LABEL[p.origen] || p.origen)}</span>` : ""}</p>
        ${esSeguro()
          ? '<p class="pz-card-meta muted">Sin cargo al cliente</p>'
          : `<div class="pz-card-precio">
              <div class="money"><span>$</span><input class="input" data-precio-pieza="${esc(p.key)}" data-dec inputmode="decimal" placeholder="Precio c/u" value="${p.precio_unitario ?? ""}" aria-label="Precio de ${esc(p.nombre)}"></div>
              <b data-subtotal="${esc(p.key)}">${sub > 0 ? money(sub) : ""}</b>
            </div>`}
      </div>`
    }
    return `<div class="side-block"><p class="side-k" style="margin-bottom:0.5rem">Piezas a cambio <span class="pz-count">${n}</span>${n > 1 ? '<span class="pz-orden">la última arriba</span>' : ""}</p>
      ${n === 0
        ? '<div class="pz-vacio">Las piezas que agregues aparecerán aquí</div>'
        : `<div class="pz-side-list">${[...state.piezas].reverse().map(tarjeta).join("")}</div>`}
    </div>`
  }

  /** Al escribir un precio en el lateral solo se recalculan los totales (no se pierde el foco). */
  function refrescarTotales(key) {
    const p = state.piezas.find((x) => x.key === key)
    const sub = p ? Number(p.precio_unitario) * Number(p.cantidad) : 0
    const el = $(`[data-subtotal="${key}"]`)
    if (el) el.textContent = sub > 0 ? money(sub) : ""
    const d = $("#side-desglose")
    if (d) d.innerHTML = desgloseHtml(cobro())
    renderNav()
    guardarBorrador()
  }

  function renderNav() {
    const prev = $("#btn-prev")
    const next = $("#btn-next")
    prev.disabled = state.step === 1
    prev.style.visibility = state.step === 1 ? "hidden" : ""
    next.classList.remove("btn-disabled-soft")
    const f = faltante(state.step + 1)
    if (state.step < 4) {
      next.innerHTML = `Siguiente${ARROW_R}`
      next.disabled = false
      $("#nav-hint").textContent = f && f.paso === state.step ? `Falta: ${f.msg}` : "Ctrl + Enter para continuar"
    } else {
      next.disabled = state.saving
      next.innerHTML = state.saving ? '<span class="spinner sm"></span>GENERANDO...' : `${CHECK}GENERAR ORDEN`
      $("#nav-hint").textContent = f ? `Falta: ${f.msg}` : "Ctrl + Enter para generar"
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
      vehiculos: state.vehiculos,
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
    num_siniestro: esSeguro() ? limpiarSiniestro(state.siniestro) : null,
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
      ...state.piezas.map((p) => ({ tipo: "pieza", concepto: p.nombre, lado: p.lado, cantidad: Number(p.cantidad), precio_unitario: p.precio_unitario })),
      ...cargosFinales().map((c) => ({ tipo: c.tipo, concepto: c.concepto, cantidad: 1, precio_unitario: c.monto })),
    ],
  })

  async function guardarCotizacion() {
    if (state.saving) return
    const f = faltante(5)
    if (f) return mandarAFaltante(f)
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
    const f = faltante(5)
    if (f) return mandarAFaltante(f)
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
      // si el servidor rechaza un dato del paso 3, se lleva ahí al usuario
      if (/siniestro|aseguradora|pieza|precio|extra|cargo|mano de obra/i.test(state.error)) {
        state.saving = false
        return mandarAFaltante({ paso: 3, sel: /siniestro/i.test(state.error) ? "#f-sin" : /aseguradora/i.test(state.error) ? "#f-aseg" : "#np-nombre", msg: state.error })
      }
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
            <a href="orden.php?id=${idOrden}" class="btn btn-primary" id="btn-ver-orden" style="padding:0.85rem 1.5rem;border-radius:12px">VER ORDEN</a>
            <a href="orden_nueva.php" class="btn btn-outline" style="padding:0.85rem 1.5rem;border-radius:12px">${PLUS}NUEVA ORDEN</a>
            <a href="ordenes.php" class="btn btn-outline" style="padding:0.85rem 1.5rem;border-radius:12px">VER ÓRDENES</a>
          </div>
        </div>
      </div>`
    $("#btn-ver-orden").focus()
  }

  // ── Eventos ────────────────────────────────────────────────────────
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
    const hostPieza = $("#np-nombre-host")
    if (hostPieza) {
      const cat = state.catalogo
      Combo.mount(hostPieza, {
        id: "np-nombre",
        items: () => cat?.piezas || [],
        value: state.nuevaPieza.nombre,
        placeholder: "Buscar pieza: faro, defensa, cofre...",
        addLabel: "Agregar pieza",
        onAdd: (texto) => (cat ? Combo.agregarPieza(cat, texto) : Promise.resolve(null)),
        onChange: (v) => {
          state.nuevaPieza = { ...state.nuevaPieza, nombre: v }
          state.errPieza = ""
          $("#err-pieza").hidden = true
          refrescarLateral()
          setTimeout(() => $("#np-lado")?.focus(), 0)
        },
      })
    }
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
    if (t.id === "f-sin") {
      t.value = limpiarSiniestro(t.value)
      const n = t.value.length
      const h = $("#sin-hint")
      h.textContent = textoSiniestro(n)
      h.className = `hint${n >= SINIESTRO_MIN ? " ok" : ""}`
    }
    if (t.dataset.f) {
      state[t.dataset.f] = t.value
      return refrescarLateral()
    }
    if (t.dataset.precioPieza) {
      const v = t.value === "" ? null : Number(t.value)
      state.piezas = state.piezas.map((p) => (p.key === t.dataset.precioPieza ? { ...p, precio_unitario: v } : p))
      return refrescarTotales(t.dataset.precioPieza)
    }
    if (t.dataset.np && t.type !== "checkbox") {
      state.nuevaPieza = { ...state.nuevaPieza, [t.dataset.np]: t.value }
      return refrescarLateral()
    }
    if (t.dataset.ne) {
      state.nuevoExtra = { ...state.nuevoExtra, [t.dataset.ne]: t.value }
      refrescarLateral()
    }
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
  Promise.all([api("api/clientes.php"), api("api/vehiculos.php"), api("api/configuracion.php"), Combo.catalogo().catch(() => null)]).then(([c, v, cfg, cat]) => {
    state.catalogo = cat || { marcas: [], piezas: [] }
    state.clientes = c.ok && Array.isArray(c.data) ? c.data : []
    state.vehiculos = v.ok && Array.isArray(v.data) ? v.data : []
    state.aseguradoras = cfg.ok && Array.isArray(cfg.data?.aseguradoras) ? cfg.data.aseguradoras : []
    restaurarBorrador()
    render()
  }).catch(() => {
    $("#step-content").innerHTML = '<div class="alert">No se pudieron cargar los datos. Revisa que MySQL esté encendido y recarga la página.</div>'
  })
})()
