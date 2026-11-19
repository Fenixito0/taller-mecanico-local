"use strict"

;(() => {
  let cotizaciones = []
  let filtro = "todos"
  let taller = { nombre_taller: "el taller" }

  async function cargar() {
    const { ok, data } = await api("api/cotizaciones.php")
    cotizaciones = ok && Array.isArray(data) ? data : []
    const abiertas = cotizaciones.filter((c) => c.estado === "abierta").length
    $("#count-label").textContent = `${cotizaciones.length} cotización${plural(cotizaciones.length, "es")} · ${abiertas} abierta${plural(abiertas)}`
    render()
  }

  const folio = (c) => `C-${pad4(c.id_cotizacion)}`

  const numPiezas = (c) => c.conceptos.filter((x) => x.tipo === "pieza").reduce((s, x) => s + x.cantidad, 0)
  const conIva = (c) => r2(c.total * (1 + TASA_IVA))

  function acciones(c) {
    const wa = whatsappUrl(c.telefono,
      `Hola ${c.cliente.split(" ")[0]}, le compartimos de ${taller.nombre_taller} la cotización ${folio(c)} para su ${c.vehiculo} (placas ${c.placas}): total ${fmtMXN(conIva(c))} IVA incluido. Quedamos atentos para iniciar el trabajo.`)
    const btns = [`<a class="act-btn act-edit" href="cotizacion_imprimir.php?id=${c.id_cotizacion}">Imprimir</a>`]
    if (wa) btns.push(`<a class="act-btn act-wa" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>`)
    if (c.estado === "abierta") btns.push(`<button type="button" class="act-btn act-del" data-convertir="${c.id_cotizacion}">${sym("checkCircle", 13)}Convertir en orden</button>`)
    else btns.push(`<a class="act-btn act-gray" href="ordenes.php?id=${c.id_orden}">Orden #${pad4(c.id_orden)}</a>`)
    if (ES_ADMIN) btns.push(`<button type="button" class="act-btn act-gray" data-del="${c.id_cotizacion}" title="Eliminar">${ICON.trash}</button>`)
    return btns.join("")
  }

  function render() {
    const q = norm($("#search").value)
    const filtered = cotizaciones.filter((c) =>
      norm(`${folio(c)} ${c.id_cotizacion} ${c.cliente} ${c.placas} ${c.vehiculo}`).includes(q)
      && (filtro === "todos" || c.estado === filtro))

    const rows = filtered.length === 0
      ? `<tr><td colspan="7" class="empty">${cotizaciones.length === 0 ? "Aún no hay cotizaciones. En «Generar Orden» elige «Guardar como cotización»." : "No se encontraron cotizaciones"}</td></tr>`
      : filtered.map((c) => {
        const piezas = numPiezas(c)
        return `
        <tr class="row">
          <td><span class="tag bold" style="letter-spacing:0">${folio(c)}</span></td>
          <td><p class="p-main">${esc(c.cliente)}</p><p class="p-sub">${esc(c.telefono || c.rfc)}</p></td>
          <td><p class="p-main" style="font-weight:400">${esc(c.vehiculo)}</p><p class="p-sub mono">${esc(c.placas)}</p></td>
          <td><p class="p-main" style="font-weight:700">${money(conIva(c))}</p>
            <p class="p-sub" style="font-size:0.72rem">${piezas} pieza${plural(piezas)} · con IVA</p></td>
          <td style="font-size:0.82rem;color:var(--text-3)">${esc(fechaMes(c.fecha))}</td>
          <td><span class="badge ${c.estado === "abierta" ? "b-warn" : "b-ok"}">${c.estado === "abierta" ? "Abierta" : "Convertida"}</span></td>
          <td><div class="actions">${acciones(c)}</div></td>
        </tr>`
      }).join("")

    $("#table-wrap").innerHTML = `
      <table class="table">
        <thead><tr><th>Folio</th><th>Cliente</th><th>Vehículo</th><th>Total</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    $("#foot").textContent = `Mostrando ${filtered.length} de ${cotizaciones.length} cotizaciones`
  }

  function convertir(c) {
    confirmDialog({
      icon: sym("checkCircle", 24, "#16A34A"),
      iconClass: "ok",
      title: "¿Convertir en orden?",
      detail: `<p class="t">${folio(c)} · ${money(conIva(c))}</p><p class="s">${esc(c.cliente)}</p><p class="m">${esc(c.placas)} · ${esc(c.vehiculo)}</p>`,
      note: "Se creará una orden particular pendiente con las piezas por llegar, la mano de obra y los extras de la cotización.",
      cancelText: "VOLVER",
      okText: "CREAR ORDEN",
      busyText: "CREANDO...",
      okClass: "btn-primary",
      onConfirm: async () => {
        const { ok, data } = await api(`api/cotizaciones.php?id=${c.id_cotizacion}&accion=convertir`, { method: "POST" })
        if (!ok) return data.error || "No se pudo convertir la cotización"
        sessionStorage.setItem("flash", `Orden #${pad4(data.id_orden)} creada desde ${folio(c)}`)
        location.href = "ordenes.php"
        return null
      },
    })
  }

  function eliminar(c) {
    confirmDialog({
      title: "¿Eliminar cotización?",
      detail: `<p class="t">${folio(c)}</p><p class="s">${esc(c.cliente)}</p>`,
      note: "Esta acción no se puede deshacer. No afecta al inventario.",
      onConfirm: async () => {
        const { ok, data } = await api(`api/cotizaciones.php?id=${c.id_cotizacion}`, { method: "DELETE" })
        if (!ok) return data.error || "Error al eliminar la cotización"
        toast("Cotización eliminada")
        cargar()
        return null
      },
    })
  }

  const buscar = (id) => cotizaciones.find((c) => c.id_cotizacion === Number(id))

  $("#search").addEventListener("input", debounce(render))
  $("#filtro-estado").addEventListener("click", (e) => {
    const b = e.target.closest("[data-val]")
    if (!b) return
    filtro = b.dataset.val
    $$("#filtro-estado .chip").forEach((c) => c.classList.toggle("active", c === b))
    render()
  })
  $("#table-wrap").addEventListener("click", (e) => {
    const cv = e.target.closest("[data-convertir]")
    if (cv) return convertir(buscar(cv.dataset.convertir))
    const del = e.target.closest("[data-del]")
    if (del) eliminar(buscar(del.dataset.del))
  })

  api("api/configuracion.php").then(({ ok, data }) => { if (ok) taller = data })
  cargar()
})()
