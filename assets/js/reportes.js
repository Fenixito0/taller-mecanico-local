"use strict"

;(() => {
  const svg = (inner, color = "var(--navy)") =>
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">${inner}</svg>`
  const ICONS = {
    list: svg('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
    clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', "#B45309"),
    ok: svg('<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', "#15803D"),
    x: svg('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>', "#C8102E"),
    money: svg('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>', "#15803D"),
    card: svg('<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
    bars: svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
    wrench: ICON.wrench(20),
  }

  // Semana actual (lunes a domingo, hora local)
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  const domingo = new Date(lunes)
  domingo.setDate(lunes.getDate() + 6)

  const st = { tab: "ordenes", desde: isoLocal(lunes), hasta: isoLocal(domingo) }
  $("#desde").value = st.desde
  $("#hasta").value = st.hasta

  let peticion = 0

  const card = ({ label, value, sub, icon, color }) => `
    <div class="rep-card">
      <div>
        <p class="k">${label}</p>
        <p class="v" style="color:${color || "var(--navy)"}">${value}</p>
        ${sub ? `<p class="s">${sub}</p>` : ""}
      </div>
      <div class="ico" style="background:${color ? `${color}15` : "#F0F4FF"}">${icon}</div>
    </div>`

  const panelHead = (title, right = "") =>
    `<div class="panel-head"><span class="t">${title}</span>${right ? `<span class="r">${right}</span>` : ""}</div>`

  function reporteOrdenes(d) {
    const r = d.resumen
    const filas = d.ordenes.length === 0
      ? '<tr><td colspan="10" style="padding:2rem;text-align:center;color:var(--muted)">No hay órdenes en este periodo</td></tr>'
      : d.ordenes.map((o) => `
        <tr>
          <td style="font-weight:700;color:var(--navy);font-size:0.88rem">#${pad4(o.id_orden)}</td>
          <td>${esc(fechaCorta(o.fecha))}</td>
          <td><span class="badge rep-${esc(o.estado)}">${esc(ESTADO_LABEL[o.estado])}</span></td>
          <td style="color:var(--navy);font-weight:500">${esc(o.cliente)}</td>
          <td>${esc(o.vehiculo)}</td>
          <td class="mono" style="font-size:0.82rem;color:var(--navy)">${esc(o.placas)}</td>
          <td>${esc(o.tipo === "seguro" ? o.aseguradora || "Seguro" : "Particular")}</td>
          <td class="t-right" style="font-weight:600;color:var(--navy)">${o.num_piezas}</td>
          <td class="t-right" style="color:${o.piezas_pendientes && o.estado === "pendiente" ? "var(--red)" : "var(--muted)"}">${o.estado === "pendiente" ? o.piezas_pendientes : "—"}</td>
          <td class="t-right" style="font-weight:700;color:${o.total_venta ? "var(--navy)" : "var(--muted)"}">${o.total_venta ? fmtMXN(o.total_venta) : "—"}</td>
        </tr>`).join("")

    return `
      <div class="rep-cards">
        ${card({ label: "Total Órdenes", value: r.total, icon: ICONS.list })}
        ${card({ label: "Pendientes", value: r.pendientes, color: "#B45309", icon: ICONS.clock })}
        ${card({ label: "Completadas", value: r.completadas, color: "#15803D", icon: ICONS.ok })}
        ${card({ label: "Canceladas", value: r.canceladas, color: "#C8102E", icon: ICONS.x })}
      </div>
      <div class="panel">
        ${panelHead("Detalle de Órdenes", `${esc(st.desde)} — ${esc(st.hasta)}`)}
        <div class="scroll-x">
          <table class="table-light" style="min-width:800px">
            <thead><tr><th># Orden</th><th>Fecha</th><th>Estado</th><th>Cliente</th><th>Vehículo</th><th>Placas</th><th>Tipo</th>
              <th class="t-right">Piezas</th><th class="t-right">Por instalar</th><th class="t-right">Total</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`
  }

  function reporteVentas(d) {
    const r = d.resumen
    const ICONOS_METODO = { efectivo: sym("cash", 20, "var(--navy)"), tarjeta: sym("card", 20, "var(--navy)"), transferencia: sym("bank", 20, "var(--navy)") }
    const metodos = ["efectivo", "tarjeta", "transferencia"].map((m) => {
      const total = r.por_metodo?.[m] || 0
      const count = r.conteo_metodo?.[m] || 0
      const pct = r.total_ingresos > 0 ? ((total / r.total_ingresos) * 100).toFixed(0) : 0
      return `
        <div class="method-card">
          <div class="h"><span>${ICONOS_METODO[m]}</span>${METODO_LABEL[m]}</div>
          <p class="v">${fmtMXN(total)}</p>
          <p class="muted" style="font-size:0.75rem">${count} venta${plural(count)} · ${pct}%</p>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>`
    }).join("")

    const top = d.top_piezas || []
    const topHtml = top.length === 0
      ? '<p style="padding:1.5rem;text-align:center;color:var(--muted);font-size:0.85rem">Sin datos</p>'
      : top.map((t, i) => `
        <div class="top-item">
          <div class="flex" style="align-items:center;gap:0.6rem">
            <span class="rank${i < 3 ? " top" : ""}">${i + 1}</span>
            <span style="font-size:0.85rem;font-weight:600;color:var(--navy)">${esc(t.nombre)}</span>
          </div>
          <div class="t-right">
            <p style="font-size:0.82rem;font-weight:700;color:var(--navy)">${t.cantidad} uds</p>
            <p class="muted" style="font-size:0.72rem">${fmtMXN(t.ingreso)}</p>
          </div>
        </div>`).join("")

    const filas = d.ventas.length === 0
      ? '<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--muted)">No hay ventas en este periodo</td></tr>'
      : d.ventas.map((v) => `
        <tr>
          <td style="font-weight:700;color:var(--red)">V-${pad4(v.id_venta)}</td>
          <td>${esc(fechaCorta(v.fecha))}</td>
          <td style="color:var(--navy);font-weight:500">${esc(v.cliente)}</td>
          <td style="font-size:0.82rem;color:var(--text-3)">${esc(METODO_LABEL[v.metodo_pago])}</td>
          <td class="t-right" style="font-weight:700;color:var(--navy)">${fmtMXN(v.total)}</td>
        </tr>`).join("")

    return `
      <div class="rep-cards">
        ${card({ label: "Total Ingresos", value: fmtMXN(r.total_ingresos), color: "#15803D", icon: ICONS.money })}
        ${card({ label: "Ventas Realizadas", value: r.total_ventas, icon: ICONS.card })}
        ${card({ label: "Ticket Promedio", value: fmtMXN(r.promedio_ticket), sub: "por venta", icon: ICONS.bars })}
        ${card({ label: "Deducibles", value: fmtMXN(r.total_deducibles), sub: `mano de obra ${fmtMXN(r.total_mano_obra)} · extras ${fmtMXN(r.total_extras)}`, icon: ICONS.wrench })}
      </div>
      <div class="rep-cards">${metodos}</div>
      <div class="rep-grid">
        <div class="panel" style="margin-bottom:0">${panelHead("Piezas más cambiadas")}${topHtml}</div>
        <div class="panel" style="margin-bottom:0">
          ${panelHead("Detalle de Ventas", `${esc(st.desde)} — ${esc(st.hasta)}`)}
          <div class="scroll-x">
            <table class="table-light">
              <thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Método</th><th class="t-right">Total</th></tr></thead>
              <tbody>${filas}</tbody>
            </table>
          </div>
        </div>
      </div>`
  }

  async function cargar() {
    const mi = ++peticion
    const report = $("#report")
    report.innerHTML = '<div class="center-screen" style="min-height:40vh"><span class="spinner lg"></span></div>'
    const qs = `desde=${encodeURIComponent(st.desde)}&hasta=${encodeURIComponent(st.hasta)}`
    try {
      const { ok, data } = await api(`api/reportes.php?tipo=${st.tab}&${qs}`)
      if (mi !== peticion) return // respuesta vieja: el usuario ya cambió el filtro
      if (!ok) {
        report.innerHTML = `<div class="alert">${esc(data.error || "Error al generar reporte")}</div>`
        return
      }
      report.innerHTML = st.tab === "ordenes" ? reporteOrdenes(data) : reporteVentas(data)
    } catch {
      if (mi === peticion) report.innerHTML = '<div class="alert">Error de conexión</div>'
    }
  }

  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]")
    if (!b || b.dataset.tab === st.tab) return
    st.tab = b.dataset.tab
    $$("#tabs .tab").forEach((t) => t.classList.toggle("active", t === b))
    cargar()
  })
  const marcarPreset = (p) => $$("#presets .chip").forEach((c) => c.classList.toggle("active", c.dataset.preset === p))

  /** Rangos rápidos de fechas. */
  function rangoPreset(p) {
    const h = new Date()
    const d = (y, m, dia) => new Date(y, m, dia)
    switch (p) {
      case "hoy": return [h, h]
      case "ayer": { const a = d(h.getFullYear(), h.getMonth(), h.getDate() - 1); return [a, a] }
      case "semana": return [lunes, domingo]
      case "mes": return [d(h.getFullYear(), h.getMonth(), 1), d(h.getFullYear(), h.getMonth() + 1, 0)]
      case "mes_ant": return [d(h.getFullYear(), h.getMonth() - 1, 1), d(h.getFullYear(), h.getMonth(), 0)]
      case "anio": return [d(h.getFullYear(), 0, 1), d(h.getFullYear(), 11, 31)]
      default: return null
    }
  }

  $("#presets").addEventListener("click", (e) => {
    const b = e.target.closest("[data-preset]")
    const r = b && rangoPreset(b.dataset.preset)
    if (!r) return
    st.desde = isoLocal(r[0])
    st.hasta = isoLocal(r[1])
    $("#desde").value = st.desde
    $("#hasta").value = st.hasta
    marcarPreset(b.dataset.preset)
    cargar()
  })

  function cambiarFecha() {
    st.desde = $("#desde").value
    st.hasta = $("#hasta").value
    if (st.desde && st.hasta && st.desde > st.hasta) {
      ;[st.desde, st.hasta] = [st.hasta, st.desde] // si se invierten, se corrigen solas
      $("#desde").value = st.desde
      $("#hasta").value = st.hasta
    }
    marcarPreset(null)
    cargar()
  }
  $("#desde").addEventListener("change", cambiarFecha)
  $("#hasta").addEventListener("change", cambiarFecha)
  $("#btn-print").addEventListener("click", () => window.print())
  $("#btn-excel").addEventListener("click", () => {
    const tipo = st.tab === "ordenes" ? "reporte_ordenes" : "reporte_ventas"
    descargar(`api/excel.php?tipo=${tipo}&desde=${encodeURIComponent(st.desde)}&hasta=${encodeURIComponent(st.hasta)}`)
  })

  cargar()
})()
