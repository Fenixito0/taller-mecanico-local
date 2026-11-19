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
      sub: `${esc(pieza.nombre)} · vacío = no se le cobra al cliente`,
      body: `<div class="field"><label class="label" for="pp-precio">Precio c/u</label>
        <div class="money"><span>$</span><input class="input" id="pp-precio" type="number" min="0" step="0.01" inputmode="decimal" value="${pieza.precio_unitario ?? ""}"></div></div>`,
      onSubmit: async (ov) => {
        const v = ov.querySelector("#pp-precio").value
        const { ok, data } = await api(`api/piezas.php?id=${pieza.id_pieza}&accion=precio`, { method: "PATCH", body: { precio_unitario: v === "" ? null : Number(v) } })
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

  function agregarPieza(orden, onDone) {
    const seguro = orden.tipo === "seguro"
    const lados = Object.entries(LADO_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")
    miniModal({
      title: "AGREGAR PIEZA",
      sub: `Orden #${pad4(orden.id_orden)} · ${esc(TIPO_ORDEN_LABEL[orden.tipo])}`,
      body: `
        <div class="field"><label class="label" for="ap-nombre">Pieza *</label>
          <input class="input" id="ap-nombre" maxlength="100" list="ap-dl" autocomplete="off"><datalist id="ap-dl"></datalist></div>
        <div class="form-grid3">
          <div class="field"><label class="label" for="ap-lado">Lado</label><select class="input" id="ap-lado">${lados}</select></div>
          ${seguro ? `<div class="field"><label class="label" for="ap-origen">La consigue</label>
            <select class="input" id="ap-origen"><option value="aseguradora">Aseguradora</option><option value="taller">Taller</option></select></div>` : ""}
          <div class="field"><label class="label" for="ap-cant">Cantidad</label><input class="input" id="ap-cant" type="number" min="1" max="999" value="1"></div>
        </div>
        <div class="field"><label class="label" for="ap-precio">Precio c/u ${seguro ? "(solo si la paga el cliente)" : "*"}</label>
          <div class="money"><span>$</span><input class="input" id="ap-precio" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div></div>
        <label class="check-line"><input type="checkbox" id="ap-extra"> Es un <b>extra</b> (lo pide el cliente)</label>`,
      okText: "AGREGAR",
      onSubmit: async (ov) => {
        const precio = ov.querySelector("#ap-precio").value
        const body = {
          nombre: ov.querySelector("#ap-nombre").value,
          lado: ov.querySelector("#ap-lado").value,
          origen: seguro ? ov.querySelector("#ap-origen").value : "taller",
          cantidad: Number(ov.querySelector("#ap-cant").value),
          precio_unitario: precio === "" ? null : Number(precio),
          es_extra: ov.querySelector("#ap-extra").checked,
        }
        const { ok, data } = await api(`api/piezas.php?orden=${orden.id_orden}`, { method: "POST", body })
        if (!ok) return data.error || "No se pudo agregar la pieza"
        toast("Pieza agregada")
        onDone()
        return null
      },
    })
    const input = $("#ap-nombre")
    input?.addEventListener("input", debounce(async () => {
      if (input.value.trim().length < 2) return
      const { ok, data } = await api(`api/piezas.php?sugerir=${encodeURIComponent(input.value)}`)
      if (ok && Array.isArray(data) && $("#ap-dl")) $("#ap-dl").innerHTML = data.map((n) => `<option value="${esc(n)}">`).join("")
    }, 250))
  }

  function agregarCargo(orden, onDone) {
    const particular = orden.tipo === "particular"
    miniModal({
      title: "AGREGAR CARGO",
      sub: `Orden #${pad4(orden.id_orden)}`,
      body: `
        ${particular ? `<div class="field"><label class="label" for="ac-tipo">Tipo</label>
          <select class="input" id="ac-tipo"><option value="extra">Extra (lo pide el cliente)</option><option value="mano_obra">Mano de obra</option></select></div>` : ""}
        <div class="field"><label class="label" for="ac-concepto">Concepto *</label>
          <input class="input" id="ac-concepto" maxlength="150" placeholder="Ej. Pintura completa del vehículo"></div>
        <div class="field"><label class="label" for="ac-monto">Monto *</label>
          <div class="money"><span>$</span><input class="input" id="ac-monto" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></div></div>`,
      okText: "AGREGAR",
      onSubmit: async (ov) => {
        const body = {
          tipo: particular ? ov.querySelector("#ac-tipo").value : "extra",
          concepto: ov.querySelector("#ac-concepto").value,
          monto: Number(ov.querySelector("#ac-monto").value),
        }
        const { ok, data } = await api(`api/cargos.php?orden=${orden.id_orden}`, { method: "POST", body })
        if (!ok) return data.error || "No se pudo agregar el cargo"
        toast("Cargo agregado")
        onDone()
        return null
      },
    })
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
          <div class="field"><label class="label" for="ed-aseg">Aseguradora</label>
            <select class="input" id="ed-aseg"><option value="">Selecciona...</option>${opts}</select></div>
          <div class="field"><label class="label" for="ed-sin">Número de siniestro</label>
            <input class="input" id="ed-sin" maxlength="40" value="${esc(orden.num_siniestro || "")}"></div>
          <div class="field"><label class="label" for="ed-ded">Deducible (IVA incluido)</label>
            <div class="money"><span>$</span><input class="input" id="ed-ded" type="number" min="0" step="0.01" value="${orden.deducible || ""}"></div></div>
        </div>
        <p class="muted" style="font-size:0.78rem" id="ed-nota"></p>`,
      onSubmit: async (ov) => {
        const tipo = ov.querySelector("#ed-tipo").value
        const body = tipo === "seguro"
          ? { tipo, aseguradora: ov.querySelector("#ed-aseg").value, num_siniestro: ov.querySelector("#ed-sin").value, deducible: Number(ov.querySelector("#ed-ded").value) || 0 }
          : { tipo }
        const { ok, data } = await api(`api/ordenes.php?id=${orden.id_orden}&accion=datos`, { method: "PATCH", body })
        if (!ok) return data.error || "No se pudieron guardar los datos"
        toast("Datos actualizados")
        onDone()
        return null
      },
    })
    const sync = () => {
      const seguro = $("#ed-tipo").value === "seguro"
      $("#ed-seguro").hidden = !seguro
      $("#ed-nota").textContent = !seguro && orden.tipo === "seguro"
        ? "Las piezas de la aseguradora pasarán a 'Taller' sin precio; usa el botón Precio si el cliente las paga." : ""
    }
    $("#ed-tipo").addEventListener("change", sync)
    sync()
  }

  return { cambiarEstado, precio, devolver, quitarPieza, agregarPieza, agregarCargo, quitarCargo, editarDatos }
})()
