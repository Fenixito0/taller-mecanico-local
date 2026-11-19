"use strict"

;(() => {
  let ordenes = []
  let filtroEstado = "todos"
  let taller = { nombre_taller: "el taller" }
  let aseguradoras = []

  // ordenes.php?id=N (enlaces viejos) → la orden se ve en su propia página
  const idInicial = Number(new URLSearchParams(location.search).get("id"))
  if (idInicial > 0) {
    location.replace(`orden.php?id=${idInicial}`)
    return
  }

  async function cargar() {
    const { ok, data } = await api("api/ordenes.php")
    ordenes = ok && Array.isArray(data) ? data : []
    $("#count-label").textContent = `${ordenes.length} orden${plural(ordenes.length, "es")} registrada${plural(ordenes.length)}`
    ;["pendiente", "completado", "cancelado"].forEach((e) => {
      $(`#c-${e}`).textContent = ordenes.filter((o) => o.estado === e).length
    })
    render()
  }

  const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>'

  function render() {
    const q = norm($("#search").value)
    const filtered = ordenes.filter((o) =>
      norm(`#${pad4(o.id_orden)} ${o.id_orden} ${o.cliente} ${o.placas} ${o.vehiculo} ${o.num_siniestro || ""}`).includes(q)
      && (filtroEstado === "todos"
        || (filtroEstado === "listo" ? o.estado === "pendiente" && o.etapa === "listo" : o.estado === filtroEstado)))

    const foot = $("#foot")
    if (filtered.length === 0) {
      $("#table-wrap").innerHTML = '<div style="padding:4rem;text-align:center"><p class="muted" style="font-size:0.95rem">No hay órdenes que mostrar</p></div>'
      foot.hidden = true
      return
    }

    const rows = filtered.map((o) => {
      const total = OrdenUI.totalOrden(o)
      const n = OrdenUI.piezasActivas(o)
      const f = o.estado === "pendiente" ? OrdenUI.faltantes(o).length : 0
      const url = `orden.php?id=${o.id_orden}`
      return `
        <tr class="row">
          <td style="width:40px;padding:0.95rem 0.5rem 0.95rem 1.25rem">
            <a class="expand-btn" href="${url}" title="Ver la orden completa" aria-label="Ver la orden #${pad4(o.id_orden)}">${ARROW}</a>
          </td>
          <td><a class="tag bold" href="${url}" style="letter-spacing:0;font-size:0.9rem">#${pad4(o.id_orden)}</a></td>
          <td><p class="p-main">${esc(o.cliente)}</p><p class="p-sub">${esc(o.telefono || o.rfc)}</p></td>
          <td><p class="p-main" style="font-weight:400">${esc(o.vehiculo)}</p><p style="margin-top:0.25rem"><span class="plate">${esc(o.placas)}</span></p></td>
          <td><p class="p-main" style="font-weight:800;font-size:1rem">${money(o.total_venta ?? total)}</p>
            <p class="p-sub" style="font-size:0.72rem">${esc(o.tipo === "seguro" ? o.aseguradora || "Seguro" : "Particular")} · ${n} pieza${plural(n)}${f > 0 ? ` · <b class="text-red">faltan ${f}</b>` : ""}${o.anticipo > 0 && o.estado === "pendiente" ? ` · anticipo ${money(o.anticipo)}` : ""}</p></td>
          <td style="font-size:0.82rem;color:var(--text-3)">${esc(fechaMes(o.fecha_creacion))}</td>
          <td>${OrdenUI.etapaCtrl(o)}</td>
          <td><div class="actions">${OrdenUI.acciones(o, taller)}</div></td>
        </tr>`
    }).join("")

    $("#table-wrap").innerHTML = `
      <table class="table">
        <thead><tr><th style="width:40px"></th><th># Orden</th><th>Cliente</th><th>Vehículo</th><th>Total</th><th>Fecha</th><th>Etapa / estado</th><th>Acciones</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    foot.hidden = false
    foot.textContent = `Mostrando ${filtered.length} de ${ordenes.length} órdenes`
  }

  const buscar = (id) => ordenes.find((o) => o.id_orden === Number(id))

  $("#search").addEventListener("input", debounce(render))
  $("#filtro-estado").addEventListener("click", (e) => {
    const b = e.target.closest("[data-val]")
    if (!b) return
    filtroEstado = b.dataset.val
    $$("#filtro-estado .chip").forEach((c) => c.classList.toggle("active", c === b))
    render()
  })
  $("#table-wrap").addEventListener("click", (e) => {
    OrdenUI.manejarClick(e, {
      buscar,
      aseguradoras: () => aseguradoras,
      onDone: (recargar) => (recargar ? cargar() : render()),
      // faltan piezas: se abre la orden para marcarlas
      alFaltar: (o) => setTimeout(() => { location.href = `orden.php?id=${o.id_orden}#piezas` }, 900),
    })
  })

  api("api/configuracion.php").then(({ ok, data }) => { if (ok) { taller = data; aseguradoras = data.aseguradoras || [] } })
  cargar()
})()
