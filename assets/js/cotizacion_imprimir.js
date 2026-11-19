"use strict"

;(() => {
  const root = $("#cot-root")
  const id = Number(root.dataset.id)
  const ICON_PRINT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>'

  function noEncontrada() {
    root.innerHTML = `
      <div class="center-screen">
        <p class="cond" style="font-size:1.5rem;font-weight:700;color:var(--navy)">Cotización no encontrada</p>
        <a href="cotizaciones.php" class="btn btn-primary" style="margin-top:1.5rem;box-shadow:none">Volver a Cotizaciones</a>
      </div>`
  }

  function render(c) {
    const t = c.taller || {}
    const folio = `C-${pad4(c.id_cotizacion)}`
    const fila = (x) => `
      <tr>
        <td>${x.tipo === "extra" ? "EXTRA · " : ""}${esc(x.concepto)}${x.tipo === "pieza" && x.lado !== "NA" ? ` <span class="muted">(${esc(LADO_CORTO[x.lado] || x.lado)})</span>` : ""}</td>
        <td class="num">${x.cantidad}</td>
        <td class="num">${money(x.precio_unitario)}</td>
        <td class="num"><b>${money(x.precio_unitario * x.cantidad)}</b></td>
      </tr>`
    const SECCIONES = [["pieza", "Piezas"], ["mano_obra", "Mano de obra"], ["extra", "Extras"]]
    const filas = SECCIONES.map(([tipo, titulo]) => {
      const xs = c.conceptos.filter((x) => x.tipo === tipo)
      return xs.length ? `<tr class="doc-sec"><td colspan="4"><b>${titulo}</b></td></tr>${xs.map(fila).join("")}` : ""
    }).join("")
    const subtotal = c.total
    const iva = r2(subtotal * TASA_IVA)

    root.innerHTML = `
      <div class="no-print page-head" style="align-items:center;margin-bottom:1.5rem">
        <div class="flex" style="align-items:center;gap:1rem">
          <a href="cotizaciones.php" class="back-btn" aria-label="Volver"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></a>
          <div><h1 class="page-title" style="font-size:1.75rem">COTIZACIÓN ${folio}</h1>
            <p class="page-sub" style="margin-top:0">${c.estado === "abierta" ? "Abierta" : `Convertida en orden #${pad4(c.id_orden)}`}</p></div>
        </div>
        <button type="button" class="btn btn-primary" id="btn-print">${ICON_PRINT}IMPRIMIR</button>
      </div>

      <div class="doc-sheet">
        <div class="doc-head">
          <div>
            <p class="doc-taller">${esc(t.nombre_taller || "Taller Mecánico")}</p>
            ${t.eslogan ? `<p class="doc-muted">${esc(t.eslogan)}</p>` : ""}
            ${t.direccion ? `<p class="doc-muted">${esc(t.direccion)}</p>` : ""}
            <p class="doc-muted">${[t.telefono ? `Tel: ${esc(t.telefono)}` : "", t.rfc ? `RFC: ${esc(t.rfc)}` : ""].filter(Boolean).join(" · ")}</p>
          </div>
          <div style="text-align:right">
            <p class="doc-title">COTIZACIÓN</p>
            <p><b>Folio:</b> ${folio}</p>
            <p><b>Fecha:</b> ${esc(fechaLarga(c.fecha))}</p>
          </div>
        </div>

        <div class="doc-cols">
          <div><p class="doc-k">CLIENTE</p>
            <p><b>${esc(c.cliente)}</b></p><p>RFC: ${esc(c.rfc)}</p>
            ${c.telefono ? `<p>Tel: ${esc(c.telefono)}</p>` : ""}${c.correo ? `<p>${esc(c.correo)}</p>` : ""}</div>
          <div><p class="doc-k">VEHÍCULO</p>
            <p><b>${esc(c.vehiculo)}</b></p><p>Placas: ${esc(c.placas)}${c.color ? ` · ${esc(c.color)}` : ""}</p>
            ${c.kilometraje !== null ? `<p>Kilometraje: ${esc(km(c.kilometraje))}</p>` : ""}</div>
        </div>

        <table class="doc-table">
          <thead><tr><th>Concepto</th><th class="num">Cant.</th><th class="num">Precio unit.</th><th class="num">Importe</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>

        <div class="doc-totals">
          <div><span>Subtotal</span><span>${money(subtotal)}</span></div>
          <div><span>IVA 16%</span><span>${money(iva)}</span></div>
          <div class="big"><span>Total estimado</span><span>${money(subtotal + iva)}</span></div>
        </div>

        ${c.observaciones ? `<div class="doc-obs"><p class="doc-k">OBSERVACIONES</p><p style="white-space:pre-wrap">${esc(c.observaciones)}</p></div>` : ""}

        <p class="doc-note">Precios sujetos a cambio y a disponibilidad de las piezas.</p>
        <div class="doc-sign"><div>Atendió: ${esc(c.usuario || "")}</div><div>Firma de conformidad del cliente</div></div>
      </div>`
    $("#btn-print").addEventListener("click", () => window.print())
  }

  api(`api/cotizaciones.php?id=${id}`).then(({ ok, data }) => (ok ? render(data) : noEncontrada())).catch(noEncontrada)
})()
