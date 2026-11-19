"use strict"

;(() => {
  const root = $("#recibo-root")
  const id = Number(root.dataset.id)
  const DASH = "- - - - - - - - - - - - - - - - - - - -"
  const ICON_FILE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
  const ICON_PRINT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>'

  const row = (l, r, bold = false) => `<div class="row2"><span>${l}</span><span${bold ? ' style="font-weight:bold"' : ""}>${r}</span></div>`
  const dash = (extra = "") => `<p class="dash"${extra}>${DASH}</p>`

  function noEncontrada() {
    root.innerHTML = `
      <div class="center-screen">
        <p class="cond" style="font-size:1.5rem;font-weight:700;color:var(--navy)">Venta no encontrada</p>
        <p class="muted" style="margin-top:0.5rem">No se encontró un recibo para la orden #${id}.</p>
        <a href="ordenes.php" class="btn btn-primary" style="margin-top:1.5rem;box-shadow:none">Volver a Órdenes</a>
      </div>`
  }

  function render(v) {
    const fv = new Date(v.fecha_venta)
    const fecha = fv.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })
    const hora = fv.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    const t = v.taller || {}
    const base = (v.importe_piezas || 0) + (v.mano_obra || 0) + (v.extras || 0) - (v.descuento || 0)
    const seguro = v.tipo === "seguro"
    const nombre = [v.cliente.nombre, v.cliente.apellido_paterno, v.cliente.apellido_materno].filter(Boolean).join(" ")
    const ahora = new Date()
    const folio = `V-${pad4(v.id_venta)}`
    const ordenTxt = `#${pad4(v.id_orden)}`

    const items = v.piezas.map((p) => `
      <div style="margin-bottom:2mm">
        <p style="font-weight:bold">${p.es_extra ? "EXTRA · " : ""}${esc(p.nombre)} <span style="font-weight:normal;font-size:10px">(${esc(LADO_CORTO[p.lado] || p.lado)})</span></p>
        <div class="row2" style="font-size:11px;color:#333">
          ${piezaCobrable(p)
            ? `<span>&nbsp;&nbsp;${p.cantidad} x ${money(p.precio_unitario)}</span><span style="font-weight:bold;color:#000">${money(p.precio_unitario * p.cantidad)}</span>`
            : `<span>&nbsp;&nbsp;${p.cantidad} pza</span><span>${p.origen === "aseguradora" ? `Cubierta por ${esc(v.aseguradora || "aseguradora")}` : "Sin cargo"}</span>`}
        </div>
      </div>`).join("")
    const cargos = v.cargos.filter((c) => c.tipo === "extra" || !seguro).map((c) => `
      <div class="row2" style="margin-bottom:1mm"><span>${c.tipo === "extra" ? "EXTRA · " : ""}${esc(c.concepto)}</span><span style="font-weight:bold">${money(c.monto)}</span></div>`).join("")

    root.innerHTML = `
      <div class="no-print page-head" style="align-items:center;margin-bottom:1.5rem">
        <div class="flex" style="align-items:center;gap:1rem">
          <a href="ordenes.php" class="back-btn" aria-label="Volver"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></a>
          <div>
            <h1 class="page-title" style="font-size:1.75rem">RECIBO DE VENTA</h1>
            <p class="page-sub" style="margin-top:0;font-size:0.82rem">Orden ${ordenTxt}</p>
          </div>
        </div>
        <div class="flex" style="gap:0.75rem">
          <a href="ordenes.php" class="btn btn-outline" style="padding:0.7rem 1.25rem;font-size:0.85rem;letter-spacing:0.08em">VOLVER</a>
          <button type="button" class="btn btn-excel" id="btn-excel" style="font-size:0.85rem;letter-spacing:0.08em">${ICON_FILE}EXCEL</button>
          <button type="button" class="btn btn-primary" id="btn-print" style="padding:0.7rem 1.5rem;font-size:0.85rem;letter-spacing:0.08em">${ICON_PRINT}IMPRIMIR</button>
        </div>
      </div>

      <div id="recibo-ticket">
        <div style="text-align:center;margin-bottom:2mm">
          <p style="font-size:18px;font-weight:bold;letter-spacing:2px">${esc((t.nombre_taller || "Taller Mecánico").toUpperCase())}</p>
          ${t.eslogan ? `<p style="font-size:10px;letter-spacing:1px">${esc(t.eslogan.toUpperCase())}</p>` : ""}
          ${t.direccion ? `<p style="font-size:10px;margin-top:1mm">${esc(t.direccion)}</p>` : ""}
          ${t.telefono ? `<p style="font-size:10px">Tel: ${esc(t.telefono)}</p>` : ""}
          ${t.rfc ? `<p style="font-size:10px;margin-top:1mm">RFC: ${esc(t.rfc)}</p>` : ""}
          ${dash(' style="margin-top:1mm"')}
          <p style="font-size:14px;font-weight:bold;margin-top:1mm">RECIBO DE VENTA</p>
          ${dash()}
        </div>

        <div style="margin-bottom:3mm">
          ${row("Folio:", folio, true)}
          ${row("Orden:", ordenTxt, true)}
          ${row("Fecha:", `${esc(fecha)} ${esc(hora)}`)}
        </div>
        ${dash()}

        <div style="margin:2mm 0 3mm">
          <p class="h">CLIENTE</p>
          <p>${esc(nombre)}</p>
          <p>RFC: ${esc(v.cliente.rfc)}</p>
          ${v.cliente.telefono ? `<p>Tel: ${esc(v.cliente.telefono)}</p>` : ""}
        </div>
        <div style="margin-bottom:2mm">
          <p class="h">VEHICULO</p>
          <p>${esc(v.vehiculo.marca || "")} ${esc(v.vehiculo.modelo)} ${esc(v.vehiculo.anio)}</p>
          <p>Placas: ${esc(v.vehiculo.placas)}${v.vehiculo.color ? `&nbsp;&nbsp;Color: ${esc(v.vehiculo.color)}` : ""}</p>
          ${seguro ? `<p>Aseguradora: ${esc(v.aseguradora || "")}</p>${v.num_siniestro ? `<p>Siniestro: ${esc(v.num_siniestro)}</p>` : ""}` : ""}
          ${v.kilometraje !== null && v.kilometraje !== undefined ? `<p>Kilometraje: ${esc(km(v.kilometraje))}</p>` : ""}
        </div>
        ${dash()}

        <div style="margin:2mm 0">
          <div class="row2" style="font-weight:bold;font-size:11px;border-bottom:1px solid #000;padding-bottom:1mm;margin-bottom:1mm">
            <span>DESCRIPCION</span><span>IMPORTE</span>
          </div>
          ${items || '<p style="font-size:11px">Sin piezas</p>'}
          ${cargos ? `<div style="margin-top:2mm;border-top:1px dashed #000;padding-top:1mm">${cargos}</div>` : ""}
        </div>
        ${dash()}

        <div style="margin:2mm 0">
          ${v.importe_piezas > 0 ? row("Piezas:", money(v.importe_piezas)) : ""}
          ${v.mano_obra > 0 ? row("Mano de obra:", money(v.mano_obra)) : ""}
          ${v.extras > 0 ? row("Extras:", money(v.extras)) : ""}
          ${v.descuento > 0 ? row("Descuento:", `-${money(v.descuento)}`) : ""}
          ${v.iva > 0 ? row("Base:", money(base)) + row("IVA (16%):", money(v.iva)) : ""}
          ${v.deducible > 0 ? row("Deducible (IVA incl.):", money(v.deducible)) : ""}
          <div class="row2" style="font-weight:bold;font-size:16px;border-top:2px solid #000;margin-top:2mm;padding-top:2mm">
            <span>TOTAL:</span><span>${money(v.precio_total)}</span>
          </div>
          ${v.anticipo > 0 ? row("Anticipos:", `-${money(v.anticipo)}`) + row("Pagado al entregar:", money(Math.max(0, v.precio_total - v.anticipo)), true) : ""}
        </div>
        ${dash()}

        <div style="margin:2mm 0">
          ${v.precio_total - (v.anticipo || 0) > 0.009 ? row("Metodo de pago:", esc(METODO_LABEL[v.metodo_pago] || v.metodo_pago), true) : ""}
          ${row("Estado:", "PAGADO", true)}
        </div>
        ${dash()}

        <div style="text-align:center;margin-top:4mm">
          <p style="font-weight:bold;font-size:13px">*** ${esc((t.mensaje_recibo || "Gracias por su preferencia").toUpperCase())} ***</p>
          <p style="font-size:10px;margin-top:3mm;color:#555">Conserve este ticket como</p>
          <p style="font-size:10px;color:#555">comprobante de pago</p>
          <p style="font-size:9px;margin-top:4mm;color:#999">Impreso: ${ahora.toLocaleDateString("es-MX")} ${ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</p>
          <p style="font-size:9px;color:#999">Folio: ${folio} | Orden: ${ordenTxt}</p>
        </div>
      </div>`

    $("#btn-print").addEventListener("click", () => window.print())
    $("#btn-excel").addEventListener("click", () => descargar(`api/excel.php?tipo=orden&id=${id}`))
  }

  api(`api/ventas.php?orden=${id}`).then(({ ok, data }) => {
    if (!ok) return noEncontrada()
    render(data)
  }).catch(noEncontrada)
})()
