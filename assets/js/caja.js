"use strict"

;(() => {
  const TIPO_LABEL = { anticipo: "Anticipo", liquidacion: "Cobro", devolucion: "Devolución" }
  const METODO_SYM = { efectivo: "cash", tarjeta: "card", transferencia: "bank" }
  const input = $("#fecha")
  let ultimo = null

  const hoyLocal = () => isoLocal(new Date())
  function moverDia(delta) {
    const d = new Date(`${input.value || hoyLocal()}T12:00:00`)
    d.setDate(d.getDate() + delta)
    input.value = isoLocal(d)
    cargar()
  }

  async function cargar() {
    const fecha = input.value || hoyLocal()
    $("#dia-next").disabled = fecha >= hoyLocal()
    const { ok, data } = await api(`api/caja.php?fecha=${encodeURIComponent(fecha)}`)
    if (!ok) {
      $("#caja-root").innerHTML = `<div class="alert">${esc(data.error || "No se pudo generar el corte")}</div>`
      return
    }
    ultimo = data
    render(data)
  }

  function render(d) {
    const t = d.taller || {}
    const fechaTxt = new Date(`${d.fecha}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    const metodos = Object.entries(d.por_metodo).map(([m, v]) => `
      <div class="method-card">
        <div class="h"><span>${sym(METODO_SYM[m] || "cash", 18, "var(--navy)")}</span>${esc(METODO_LABEL[m] || m)}</div>
        <p class="v" style="color:${v < 0 ? "var(--red)" : "var(--navy)"}">${money(v)}</p>
      </div>`).join("")

    const filas = d.movimientos.length === 0
      ? '<tr><td colspan="7" class="empty">No hubo movimientos de dinero este día</td></tr>'
      : d.movimientos.map((m) => `
        <tr class="row">
          <td style="font-size:0.82rem">${esc(new Date(m.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }))}</td>
          <td><span class="tag bold" style="letter-spacing:0">#${pad4(m.id_orden)}</span></td>
          <td><p class="p-main">${esc(m.cliente)}</p><p class="p-sub mono">${esc(m.placas)}</p></td>
          <td><span class="badge ${m.tipo === "devolucion" ? "b-bad" : m.tipo === "anticipo" ? "b-warn" : "b-ok"}">${TIPO_LABEL[m.tipo] || esc(m.tipo)}</span></td>
          <td>${esc(METODO_LABEL[m.metodo] || m.metodo)}</td>
          <td style="font-size:0.82rem;color:var(--text-3)">${esc(m.usuario || "—")}</td>
          <td class="td-bold" style="text-align:right;color:${m.monto < 0 ? "var(--red)" : "var(--navy)"}">${money(m.monto)}</td>
        </tr>`).join("")

    $("#caja-root").innerHTML = `
      <div class="print-only doc-head" style="margin-bottom:1rem">
        <div><p class="doc-taller">${esc(t.nombre_taller || "Taller Mecánico")}</p>
          ${t.direccion ? `<p class="doc-muted">${esc(t.direccion)}</p>` : ""}</div>
        <div style="text-align:right"><p class="doc-title">CORTE DE CAJA</p><p>${esc(fechaTxt)}</p></div>
      </div>
      <p class="no-print" style="margin-bottom:1rem;font-weight:600;color:var(--navy);text-transform:capitalize">${esc(fechaTxt)}</p>

      <div class="rep-cards">
        <div class="rep-card"><div><p class="k">Total en caja</p><p class="v" style="color:var(--red)">${money(d.total)}</p>
          <p class="s">${d.movimientos.length} movimiento${plural(d.movimientos.length)}</p></div></div>
        <div class="rep-card"><div><p class="k">Cobros (liquidaciones)</p><p class="v">${money(d.por_tipo.liquidacion)}</p>
          <p class="s">${d.num_ventas} venta${plural(d.num_ventas)} cerrada${plural(d.num_ventas)}</p></div></div>
        <div class="rep-card"><div><p class="k">Anticipos</p><p class="v">${money(d.por_tipo.anticipo)}</p></div></div>
        <div class="rep-card"><div><p class="k">Devoluciones</p><p class="v" style="color:${d.por_tipo.devolucion < 0 ? "var(--red)" : "inherit"}">${money(d.por_tipo.devolucion)}</p>
          ${d.descuentos > 0 ? `<p class="s">Descuentos otorgados: ${money(d.descuentos)}</p>` : ""}</div></div>
      </div>

      <div class="rep-cards">${metodos}</div>

      <div class="card">
        <table class="table">
          <thead><tr><th>Hora</th><th>Orden</th><th>Cliente</th><th>Tipo</th><th>Método</th><th>Usuario</th><th style="text-align:right">Monto</th></tr></thead>
          <tbody>${filas}</tbody>
          ${d.movimientos.length ? `<tfoot><tr><td colspan="6" class="total-label" style="padding:0.9rem 1.25rem">TOTAL DEL DÍA</td>
            <td class="total-val" style="text-align:right;padding:0.9rem 1.25rem">${money(d.total)}</td></tr></tfoot>` : ""}
        </table>
      </div>
      <div class="print-only doc-sign" style="margin-top:3rem"><div>Entregó</div><div>Recibió</div></div>`
  }

  input.value = hoyLocal()
  input.max = hoyLocal()
  input.addEventListener("change", cargar)
  $("#dia-prev").addEventListener("click", () => moverDia(-1))
  $("#dia-next").addEventListener("click", () => moverDia(1))
  $("#dia-hoy").addEventListener("click", () => { input.value = hoyLocal(); cargar() })
  $("#btn-print").addEventListener("click", () => { if (ultimo) window.print() })
  cargar()
})()
