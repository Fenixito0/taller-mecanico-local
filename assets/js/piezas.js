"use strict"

;(() => {
  let piezas = []
  let estado = ""
  let aseguradora = ""

  const ACCIONES = {
    pendiente: [["recibida", "Recibida"], ["instalada", "Instalada"], ["devolver", "Devolver"]],
    recibida: [["instalada", "Instalada"], ["devolver", "Devolver"]],
    instalada: [],
    devuelta: [],
  }

  async function cargar() {
    const qs = new URLSearchParams({ estado, aseguradora })
    const { ok, data } = await api(`api/piezas.php?${qs}`)
    piezas = ok && Array.isArray(data) ? data : []
    const porLlegar = piezas.filter((p) => p.estado === "pendiente").length
    $("#count-label").textContent = `${piezas.length} pieza${plural(piezas.length)} en la lista · ${porLlegar} por llegar`
    render()
  }

  const diasTxt = (d) => (d === 0 ? "hoy" : `${d} día${plural(d)}`)

  function render() {
    const q = norm($("#search").value)
    const f = piezas.filter((p) => norm(`${p.nombre} ${p.placas} ${p.cliente} ${p.vehiculo} #${pad4(p.id_orden)} ${p.id_orden} ${p.aseguradora || ""}`).includes(q))
    if (f.length === 0) {
      $("#table-wrap").innerHTML = '<div style="padding:4rem;text-align:center"><p class="muted" style="font-size:0.95rem">No hay piezas que mostrar</p></div>'
      $("#foot").hidden = true
      return
    }
    $("#table-wrap").innerHTML = `
      <table class="table">
        <thead><tr><th>Pieza</th><th>Orden</th><th>Vehículo</th><th>Cliente</th><th>La consigue</th><th>Estado</th><th>Tiempo</th><th>Acciones</th></tr></thead>
        <tbody>${f.map((p) => `
          <tr>
            <td><p class="p-main">${esc(p.nombre)} ${p.es_extra ? extraBadge() : ""}</p>
              <p class="p-sub">${esc(LADO_LABELS[p.lado] || p.lado)}${p.cantidad > 1 ? ` · ×${p.cantidad}` : ""}${p.estado === "devuelta" && p.motivo_devolucion ? ` · ${esc(p.motivo_devolucion)}` : ""}</p></td>
            <td><a class="tag bold" href="orden.php?id=${p.id_orden}" style="letter-spacing:0">#${pad4(p.id_orden)}</a></td>
            <td><p class="p-main" style="font-weight:400">${esc(p.vehiculo)}</p><p class="p-sub mono">${esc(p.placas)}</p></td>
            <td>${esc(p.cliente)}</td>
            <td>${p.origen === "aseguradora" ? esc(p.aseguradora || "Aseguradora") : "Taller"}</td>
            <td>${piezaEstadoBadge(p.estado)}</td>
            <td class="${p.dias >= 7 ? "text-red" : ""}" style="font-size:0.82rem">${diasTxt(p.dias)}</td>
            <td><div class="actions">${ACCIONES[p.estado].map(([a, l]) =>
              `<button type="button" class="act-btn ${a === "devolver" ? "act-del" : "act-edit"}" data-accion="${a}" data-pieza="${p.id_pieza}">${l}</button>`).join("")}</div></td>
          </tr>`).join("")}</tbody>
      </table>`
    $("#foot").hidden = false
    $("#foot").textContent = `Mostrando ${f.length} de ${piezas.length} piezas · el tiempo cuenta desde el último cambio de estado`
  }

  $("#search").addEventListener("input", debounce(render))
  $("#filtro-estado").addEventListener("click", (e) => {
    const b = e.target.closest("[data-val]")
    if (!b) return
    estado = b.dataset.val
    $$("#filtro-estado .chip").forEach((c) => c.classList.toggle("active", c === b))
    cargar()
  })
  $("#filtro-aseg").addEventListener("change", (e) => { aseguradora = e.target.value; cargar() })
  $("#table-wrap").addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]")
    if (!b) return
    const p = piezas.find((x) => x.id_pieza === Number(b.dataset.pieza))
    if (b.dataset.accion === "devolver") return PiezasUI.devolver(p, cargar)
    PiezasUI.cambiarEstado(p, b.dataset.accion, cargar)
  })

  api("api/configuracion.php").then(({ ok, data }) => {
    if (!ok) return
    $("#filtro-aseg").insertAdjacentHTML("beforeend", (data.aseguradoras || []).map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join(""))
  })
  cargar()
})()
