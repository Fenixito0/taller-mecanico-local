/* Acciones sobre piezas, cargos y datos de seguro de una orden (detalle de orden y tablero de piezas).
   Cada función llama a la API y ejecuta onDone() cuando el cambio se guardó. */
"use strict"

const PiezasUI = (() => {
  const ESTADO_TOAST = { recibida: "recibida", instalada: "instalada", pendiente: "pendiente de llegar" }

  async function cambiarEstado(pieza, estado, onDone) {
    const { ok, data } = await api(`api/piezas.php?id=${pieza.id_pieza}&accion=estado`, { method: "PATCH", body: { estado } })
    if (!ok) return toast(data.error || "No se pudo cambiar el estado", "error")
    toast(`${pieza.nombre}: ${ESTADO_TOAST[estado] || estado}`)
    onDone()
  }

  function devolver(pieza, onDone) {
    miniModal({
      title: "DEVOLVER PIEZA",
      sub: `${esc(pieza.nombre)} · se creará la pieza de reemplazo como pendiente`,
      body: `
        <div class="field"><label class="label" for="dev-motivo">Motivo de la devolución *</label>
          <input class="input" id="dev-motivo" maxlength="200" placeholder="Ej. Llegó rota, no corresponde al modelo..."></div>`,
      okText: "DEVOLVER",
      onSubmit: async (ov) => {
        const motivo = ov.querySelector("#dev-motivo").value.trim()
        if (!motivo) return "Escribe el motivo"
        const { ok, data } = await api(`api/piezas.php?id=${pieza.id_pieza}&accion=devolver`, { method: "PATCH", body: { motivo } })
        if (!ok) return data.error || "No se pudo devolver la pieza"
        toast(`${pieza.nombre} devuelta; el reemplazo quedó pendiente`)
        onDone()
        return null
      },
    })
  }

  function precio(pieza, onDone) {
    miniModal({
      title: "PRECIO AL CLIENTE",
      sub: `${esc(pieza.nombre)} · precio por unidad`,
      body: `<div class="field"><label class="label" for="pp-precio">Precio c/u *</label>
        <div class="money"><span>$</span><input class="input input-lg" id="pp-precio" type="number" min="0.01" step="0.01" inputmode="decimal" value="${pieza.precio_unitario ?? ""}"></div></div>`,
      onSubmit: async (ov) => {
        const v = ov.querySelector("#pp-precio").value
        if (!(Number(v) > 0)) return "Indica un precio mayor a cero"
        const { ok, data } = await api(`api/piezas.php?id=${pieza.id_pieza}&accion=precio`, { method: "PATCH", body: { precio_unitario: Number(v) } })
        if (!ok) return data.error || "No se pudo guardar el precio"
        toast("Precio actualizado")
        onDone()
        return null
      },
    })
  }

  function quitarPieza(pieza, onDone) {
    confirmDialog({
      title: "¿Quitar pieza?",
      detail: `<p class="t">${esc(pieza.nombre)}</p>`,
      note: "Solo se pueden quitar piezas que aún no llegan.",
      okText: "QUITAR",
      busyText: "QUITANDO...",
      onConfirm: async () => {
        const { ok, data } = await api(`api/piezas.php?id=${pieza.id_pieza}`, { method: "DELETE" })
        if (!ok) return data.error || "No se pudo quitar la pieza"
        toast("Pieza quitada")
        onDone()
        return null
      },
    })
  }

  /** Pieza nueva en una orden abierta: se elige del catálogo; en seguro no lleva precio. */
  async function agregarPieza(orden, onDone) {
    let cat
    try { cat = await Combo.catalogo() } catch { cat = { marcas: [], piezas: [] } }
    const seguro = orden.tipo === "seguro"
    const lados = Object.entries(LADO_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")
    let nombre = ""
    const ov = miniModal({
      title: "AGREGAR PIEZA",
      sub: `Orden #${pad4(orden.id_orden)} · ${esc(TIPO_ORDEN_LABEL[orden.tipo])}`,
      body: `
        <div class="field"><label class="label" for="ap-nombre">Pieza *</label><div id="ap-nombre-host"></div></div>
        <div class="form-grid3">
          <div class="field"><label class="label" for="ap-lado">Lado</label><select class="input" id="ap-lado">${lados}</select></div>
          ${seguro ? `<div class="field"><label class="label" for="ap-origen">La consigue</label>
            <select class="input" id="ap-origen"><option value="aseguradora">Aseguradora</option><option value="taller">Taller</option></select></div>` : ""}
          <div class="field"><label class="label" for="ap-cant">Cantidad</label><input class="input" id="ap-cant" type="number" min="1" max="999" value="1"></div>
        </div>
        ${seguro
          ? '<p class="muted" style="font-size:0.78rem">En órdenes de seguro las piezas no se le cobran al cliente. Si quiere algo extra, haz una orden particular.</p>'
          : `<div class="field"><label class="label" for="ap-precio">Precio c/u *</label>
          <div class="money"><span>$</span><input class="input" id="ap-precio" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></div></div>`}`,
      okText: "AGREGAR",
      onSubmit: async (ov) => {
        if (!nombre) { combo.focus(); return "Elige la pieza de la lista (o agrégala si no existe)" }
        const cantidad = Number(ov.querySelector("#ap-cant").value)
        if (!(Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= 999)) return "La cantidad debe ser de 1 a 999"
        const precio = seguro ? null : Number(ov.querySelector("#ap-precio").value)
        if (!seguro && !(precio > 0)) { ov.querySelector("#ap-precio").focus(); return "Indica el precio de la pieza" }
        const body = {
          nombre,
          lado: ov.querySelector("#ap-lado").value,
          origen: seguro ? ov.querySelector("#ap-origen").value : "taller",
          cantidad,
          precio_unitario: precio,
          es_extra: false,
        }
        const { ok, data } = await api(`api/piezas.php?orden=${orden.id_orden}`, { method: "POST", body })
        if (!ok) return data.error || "No se pudo agregar la pieza"
        toast(`${nombre} agregada`)
        onDone()
        return null
      },
    })
    const combo = Combo.mount(ov.querySelector("#ap-nombre-host"), {
      id: "ap-nombre",
      items: () => cat.piezas,
      placeholder: "Buscar pieza...",
      addLabel: "Agregar pieza",
      onAdd: (texto) => Combo.agregarPieza(cat, texto),
      onChange: (v) => { nombre = v; setTimeout(() => ov.querySelector("#ap-lado").focus(), 0) },
    })
    combo.focus()
  }

  function agregarCargo(orden, onDone) {
    if (orden.tipo === "seguro") return toast("Las órdenes de seguro no llevan cargos: si el cliente pide algo más, haz una orden particular", "error")
    miniModal({
      title: "AGREGAR CARGO",
      sub: `Orden #${pad4(orden.id_orden)}`,
      body: `
        <div class="field"><label class="label" for="ac-tipo">Tipo</label>
          <select class="input" id="ac-tipo"><option value="mano_obra">Mano de obra</option><option value="extra">Extra (lo pide el cliente)</option></select></div>
        <div class="field"><label class="label" for="ac-concepto">Concepto *</label>
          <input class="input" id="ac-concepto" maxlength="150" value="Mano de obra"></div>
        <div class="field"><label class="label" for="ac-monto">Monto *</label>
          <div class="money"><span>$</span><input class="input input-lg" id="ac-monto" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></div></div>`,
      okText: "AGREGAR",
      onSubmit: async (ov) => {
        const concepto = ov.querySelector("#ac-concepto").value.trim()
        const monto = Number(ov.querySelector("#ac-monto").value)
        if (!concepto) return "Escribe el concepto"
        if (!(monto > 0)) return "El monto debe ser mayor a cero"
        const body = { tipo: ov.querySelector("#ac-tipo").value, concepto, monto }
        const { ok, data } = await api(`api/cargos.php?orden=${orden.id_orden}`, { method: "POST", body })
        if (!ok) return data.error || "No se pudo agregar el cargo"
        toast("Cargo agregado")
        onDone()
        return null
      },
    })
    // el concepto se sugiere según el tipo para no escribirlo de más
    const tipo = $("#ac-tipo")
    const concepto = $("#ac-concepto")
    tipo.addEventListener("change", () => {
      if (tipo.value === "mano_obra" && !concepto.value.trim()) concepto.value = "Mano de obra"
      if (tipo.value === "extra" && concepto.value === "Mano de obra") { concepto.value = ""; concepto.placeholder = "Ej. Pintura completa del vehículo" }
      concepto.focus()
    })
    $("#ac-monto").focus()
  }

  function quitarCargo(cargo, onDone) {
    confirmDialog({
      title: "¿Quitar cargo?",
      detail: `<p class="t">${esc(cargo.concepto)}</p><p class="m">${money(cargo.monto)}</p>`,
      okText: "QUITAR",
      busyText: "QUITANDO...",
      onConfirm: async () => {
        const { ok, data } = await api(`api/cargos.php?id=${cargo.id_cargo}`, { method: "DELETE" })
        if (!ok) return data.error || "No se pudo quitar el cargo"
        toast("Cargo quitado")
        onDone()
        return null
      },
    })
  }

  const SINIESTRO_MIN = 12
  const SINIESTRO_MAX = 16
  const limpiarSiniestro = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, SINIESTRO_MAX)

  function editarDatos(orden, aseguradoras, onDone) {
    const opts = aseguradoras.map((a) => `<option value="${esc(a)}"${orden.aseguradora === a ? " selected" : ""}>${esc(a)}</option>`).join("")
    miniModal({
      title: "DATOS DE LA ORDEN",
      sub: `Orden #${pad4(orden.id_orden)}`,
      body: `
        <div class="field"><label class="label" for="ed-tipo">Tipo de orden</label>
          <select class="input" id="ed-tipo">
            <option value="seguro"${orden.tipo === "seguro" ? " selected" : ""}>Seguro</option>
            <option value="particular"${orden.tipo === "particular" ? " selected" : ""}>Particular</option>
          </select></div>
        <div id="ed-seguro">
          <div class="field"><label class="label" for="ed-aseg">Aseguradora *</label>
            <select class="input" id="ed-aseg"><option value="">Selecciona...</option>${opts}</select></div>
          <div class="field"><label class="label" for="ed-sin">Número de siniestro *</label>
            <input class="input mono input-lg" id="ed-sin" maxlength="${SINIESTRO_MAX}" autocomplete="off" spellcheck="false" value="${esc(orden.num_siniestro || "")}">
            <p class="hint" id="ed-sin-hint"></p></div>
          <div class="field"><label class="label" for="ed-ded">Deducible (IVA incluido)</label>
            <div class="money"><span>$</span><input class="input" id="ed-ded" type="number" min="0" step="0.01" value="${orden.deducible || ""}"></div></div>
        </div>
        <p class="muted" style="font-size:0.78rem" id="ed-nota"></p>`,
      onSubmit: async (ov) => {
        const tipo = ov.querySelector("#ed-tipo").value
        let body = { tipo }
        if (tipo === "seguro") {
          const aseguradora = ov.querySelector("#ed-aseg").value
          const sin = limpiarSiniestro(ov.querySelector("#ed-sin").value)
          if (!aseguradora) { ov.querySelector("#ed-aseg").focus(); return "Selecciona la aseguradora" }
          if (sin.length < SINIESTRO_MIN) { ov.querySelector("#ed-sin").focus(); return `El número de siniestro lleva de ${SINIESTRO_MIN} a ${SINIESTRO_MAX} letras y números` }
          body = { tipo, aseguradora, num_siniestro: sin, deducible: Number(ov.querySelector("#ed-ded").value) || 0 }
        }
        const { ok, data } = await api(`api/ordenes.php?id=${orden.id_orden}&accion=datos`, { method: "PATCH", body })
        if (!ok) return data.error || "No se pudieron guardar los datos"
        toast("Datos actualizados")
        onDone()
        return null
      },
    })
    const sinIn = $("#ed-sin")
    const pintarSin = () => {
      sinIn.value = limpiarSiniestro(sinIn.value)
      const n = sinIn.value.length
      const h = $("#ed-sin-hint")
      h.className = `hint${n >= SINIESTRO_MIN ? " ok" : ""}`
      h.textContent = n === 0 ? `Obligatorio · de ${SINIESTRO_MIN} a ${SINIESTRO_MAX} letras y números` : `${n}/${SINIESTRO_MAX}${n < SINIESTRO_MIN ? ` · faltan ${SINIESTRO_MIN - n} como mínimo` : " ✓"}`
    }
    sinIn.addEventListener("input", pintarSin)
    pintarSin()
    const sync = () => {
      const seguro = $("#ed-tipo").value === "seguro"
      $("#ed-seguro").hidden = !seguro
      $("#ed-nota").textContent = !seguro && orden.tipo === "seguro"
        ? "Las piezas de la aseguradora pasarán a 'Taller' sin precio: después ponles precio con el botón Precio."
        : seguro && orden.tipo === "particular"
          ? "En seguro al cliente solo se le cobra el deducible: primero quita la mano de obra y los extras; los precios de las piezas se borran."
          : ""
    }
    $("#ed-tipo").addEventListener("change", sync)
    sync()
  }
  return { cambiarEstado, precio, devolver, quitarPieza, agregarPieza, agregarCargo, quitarCargo, editarDatos }
})()
