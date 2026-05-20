"use client"
import { useState, useEffect } from "react"

const ESTADO_COLORS = {
  pendiente:  { bg:"#FEF3C7", color:"#B45309", border:"#FDE68A" },
  completado: { bg:"#F0FDF4", color:"#15803D", border:"#BBF7D0" },
  cancelado:  { bg:"#FFF0F2", color:"#C8102E", border:"#FECDD3" },
}
const ESTADO_LABEL = { pendiente:"Pendiente", completado:"Completado", cancelado:"Cancelado" }
const METODO_LABEL = { efectivo:"Efectivo", tarjeta:"Tarjeta", transferencia:"Transferencia" }

function getWeekRange() {
  const now = new Date()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { desde: mon.toISOString().split("T")[0], hasta: sun.toISOString().split("T")[0] }
}

function fmt(n) { return `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits:2, maximumFractionDigits:2 })}` }

function Card({ label, value, sub, icon, color }) {
  return (
    <div style={{ background:"#fff", borderRadius:"14px", border:"1px solid var(--border)", padding:"1.25rem", boxShadow:"0 2px 12px rgba(15,31,61,0.05)", flex:1, minWidth:"160px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
        <div>
          <p style={{ fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>{label}</p>
          <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.8rem", fontWeight:800, color:color||"var(--navy)", marginTop:"0.3rem" }}>{value}</p>
          {sub && <p style={{ fontSize:"0.78rem", color:"#9CA3AF", marginTop:"0.15rem" }}>{sub}</p>}
        </div>
        {icon && <div style={{ width:"42px", height:"42px", background:color ? `${color}15` : "#F0F4FF", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{icon}</div>}
      </div>
    </div>
  )
}

function TabButton({ active, label, onClick }) {
  return (
    <button onClick={onClick} style={{ padding:"0.7rem 1.5rem", border:"none", borderBottom:active ? "3px solid var(--red)" : "3px solid transparent", background:"none", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.9rem", fontWeight:active ? 700 : 400, color:active ? "var(--navy)" : "#9CA3AF", letterSpacing:"0.06em", transition:"all 0.2s" }}>{label}</button>
  )
}

export default function ReportesPage() {
  const [tab, setTab] = useState("ordenes")
  const { desde: dInit, hasta: hInit } = getWeekRange()
  const [desde, setDesde] = useState(dInit)
  const [hasta, setHasta] = useState(hInit)
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    setLoading(true)
    setData(null)
    const url = tab === "ordenes"
      ? `/api/reportes/ordenes?desde=${desde}&hasta=${hasta}`
      : `/api/reportes/ventas?desde=${desde}&hasta=${hasta}`
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(fetchData, [tab, desde, hasta])

  const downloadExcel = () => {
    const url = tab === "ordenes"
      ? `/api/reportes/ordenes/excel?desde=${desde}&hasta=${hasta}`
      : `/api/reportes/ventas/excel?desde=${desde}&hasta=${hasta}`
    const a = document.createElement("a")
    a.href = url; a.download = ""; document.body.appendChild(a); a.click(); a.remove()
  }

  const inputStyle = { padding:"0.55rem 0.75rem", border:"2px solid var(--border)", borderRadius:"8px", fontSize:"0.85rem", color:"var(--navy)", fontFamily:"'Barlow',sans-serif" }

  return (
    <>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.5rem", flexWrap:"wrap", gap:"1rem" }}>
        <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"2rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.04em" }}>REPORTES</h1>
        <div className="no-print" style={{ display:"flex", gap:"0.75rem", alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
            <label style={{ fontSize:"0.7rem", fontWeight:700, color:"#9CA3AF", fontFamily:"'Barlow Condensed',sans-serif" }}>DESDE</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
            <label style={{ fontSize:"0.7rem", fontWeight:700, color:"#9CA3AF", fontFamily:"'Barlow Condensed',sans-serif" }}>HASTA</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={inputStyle} />
          </div>
          <button onClick={downloadExcel} style={{ padding:"0.6rem 1rem", border:"2px solid #15803D", borderRadius:"8px", background:"#F0FDF4", color:"#15803D", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.8rem", letterSpacing:"0.08em", display:"flex", alignItems:"center", gap:"0.4rem" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            EXCEL
          </button>
          <button onClick={() => window.print()} style={{ padding:"0.6rem 1rem", border:"none", borderRadius:"8px", background:"var(--red)", color:"#fff", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.8rem", letterSpacing:"0.08em", display:"flex", alignItems:"center", gap:"0.4rem" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            IMPRIMIR
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print" style={{ display:"flex", borderBottom:"1px solid var(--border)", marginBottom:"1.5rem" }}>
        <TabButton active={tab==="ordenes"} label="ÓRDENES DE SERVICIO" onClick={() => setTab("ordenes")} />
        <TabButton active={tab==="ingresos"} label="INGRESOS Y VENTAS" onClick={() => setTab("ingresos")} />
      </div>

      {loading ? (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"40vh" }}>
          <span style={{ display:"inline-block", width:"36px", height:"36px", border:"3px solid var(--border)", borderTopColor:"var(--red)", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
        </div>
      ) : tab === "ordenes" ? (
        <OrdenesReport data={data} desde={desde} hasta={hasta} />
      ) : (
        <IngresosReport data={data} desde={desde} hasta={hasta} />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}

function OrdenesReport({ data, desde, hasta }) {
  if (!data?.resumen) return null
  const { resumen, ordenes } = data
  return (
    <>
      <div id="recibo" style={{ background:"transparent" }}>
        {/* Summary Cards */}
        <div style={{ display:"flex", gap:"1rem", marginBottom:"1.5rem", flexWrap:"wrap" }}>
          <Card label="Total Órdenes" value={resumen.total} icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>} />
          <Card label="Pendientes" value={resumen.pendientes} color="#B45309" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
          <Card label="Completadas" value={resumen.completadas} color="#15803D" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
          <Card label="Canceladas" value={resumen.canceladas} color="#C8102E" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8102E" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>} />
        </div>

        {/* Table */}
        <div style={{ background:"#fff", borderRadius:"14px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,31,61,0.05)" }}>
          <div style={{ background:"var(--navy)", padding:"0.875rem 1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.78rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Detalle de Órdenes</span>
            <span style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.4)" }}>{desde} — {hasta}</span>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"800px" }}>
              <thead><tr style={{ background:"#F9FAFB" }}>
                {["# Orden","Fecha","Estado","Cliente","Vehículo","Placas","Piezas","Subtotal","Total"].map(col => (
                  <th key={col} style={{ padding:"0.6rem 1rem", textAlign:["Piezas","Subtotal","Total"].includes(col)?"right":"left", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.1em", textTransform:"uppercase" }}>{col}</th>
                ))}
              </tr></thead>
              <tbody>
                {ordenes.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding:"2rem", textAlign:"center", color:"#9CA3AF" }}>No hay órdenes en este periodo</td></tr>
                ) : ordenes.map((o, i) => {
                  const ec = ESTADO_COLORS[o.estado]
                  return (
                    <tr key={o.id_orden} style={{ borderTop:"1px solid var(--border)", background:i%2===0?"#fff":"#FAFBFC" }}>
                      <td style={{ padding:"0.65rem 1rem", fontWeight:700, color:"var(--navy)", fontSize:"0.88rem" }}>#{String(o.id_orden).padStart(4,"0")}</td>
                      <td style={{ padding:"0.65rem 1rem", fontSize:"0.85rem", color:"#4B5563" }}>{new Date(o.fecha).toLocaleDateString("es-MX")}</td>
                      <td style={{ padding:"0.65rem 1rem" }}><span style={{ background:ec.bg, color:ec.color, border:`1px solid ${ec.border}`, padding:"0.2rem 0.6rem", borderRadius:"6px", fontSize:"0.72rem", fontWeight:700 }}>{ESTADO_LABEL[o.estado]}</span></td>
                      <td style={{ padding:"0.65rem 1rem", fontSize:"0.85rem", color:"var(--navy)", fontWeight:500 }}>{o.cliente}</td>
                      <td style={{ padding:"0.65rem 1rem", fontSize:"0.85rem", color:"#4B5563" }}>{o.vehiculo}</td>
                      <td style={{ padding:"0.65rem 1rem", fontSize:"0.82rem", fontFamily:"monospace", color:"var(--navy)" }}>{o.placas}</td>
                      <td style={{ padding:"0.65rem 1rem", textAlign:"right", fontWeight:600, color:"var(--navy)" }}>{o.num_refacciones}</td>
                      <td style={{ padding:"0.65rem 1rem", textAlign:"right", color:"#4B5563" }}>{fmt(o.subtotal)}</td>
                      <td style={{ padding:"0.65rem 1rem", textAlign:"right", fontWeight:700, color:o.total_venta?"var(--navy)":"#9CA3AF" }}>{o.total_venta ? fmt(o.total_venta) : "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

function IngresosReport({ data, desde, hasta }) {
  if (!data?.resumen) return null
  const { resumen, top_refacciones, ventas } = data
  return (
    <>
      <div id="recibo" style={{ background:"transparent" }}>
        {/* Summary Cards */}
        <div style={{ display:"flex", gap:"1rem", marginBottom:"1.5rem", flexWrap:"wrap" }}>
          <Card label="Total Ingresos" value={fmt(resumen.total_ingresos)} color="#15803D" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
          <Card label="Ventas Realizadas" value={resumen.total_ventas} icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} />
          <Card label="Ticket Promedio" value={fmt(resumen.promedio_ticket)} sub="por venta" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>} />
          <Card label="Mano de Obra" value={fmt(resumen.total_mano_obra)} sub="total cobrado" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>} />
        </div>

        {/* Payment Method Breakdown */}
        <div style={{ display:"flex", gap:"1rem", marginBottom:"1.5rem", flexWrap:"wrap" }}>
          {["efectivo","tarjeta","transferencia"].map(m => {
            const icons = { efectivo:"💵", tarjeta:"💳", transferencia:"🏦" }
            const total = resumen.por_metodo?.[m] || 0
            const count = resumen.conteo_metodo?.[m] || 0
            const pct = resumen.total_ingresos > 0 ? ((total / resumen.total_ingresos) * 100).toFixed(0) : 0
            return (
              <div key={m} style={{ flex:1, minWidth:"180px", background:"#fff", borderRadius:"14px", border:"1px solid var(--border)", padding:"1rem 1.25rem", boxShadow:"0 2px 12px rgba(15,31,61,0.05)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", marginBottom:"0.5rem" }}>
                  <span style={{ fontSize:"1.3rem" }}>{icons[m]}</span>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.8rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.06em" }}>{METODO_LABEL[m]}</span>
                </div>
                <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.3rem", fontWeight:800, color:"var(--navy)" }}>{fmt(total)}</p>
                <p style={{ fontSize:"0.75rem", color:"#9CA3AF" }}>{count} venta{count!==1?"s":""} · {pct}%</p>
                <div style={{ height:"4px", background:"var(--border)", borderRadius:"2px", marginTop:"0.5rem" }}>
                  <div style={{ height:"4px", background:"var(--red)", borderRadius:"2px", width:`${pct}%`, transition:"width 0.5s" }} />
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:"1rem", marginBottom:"1.5rem" }}>
          {/* Top Refacciones */}
          <div style={{ background:"#fff", borderRadius:"14px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,31,61,0.05)" }}>
            <div style={{ background:"var(--navy)", padding:"0.875rem 1.25rem" }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.78rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Top Refacciones</span>
            </div>
            {top_refacciones.length === 0 ? (
              <p style={{ padding:"1.5rem", textAlign:"center", color:"#9CA3AF", fontSize:"0.85rem" }}>Sin datos</p>
            ) : top_refacciones.map((r, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.65rem 1.25rem", borderTop:i>0?"1px solid var(--border)":"none", background:i%2===0?"#fff":"#FAFBFC" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
                  <span style={{ width:"22px", height:"22px", borderRadius:"50%", background:i<3?"var(--red)":"var(--border)", color:i<3?"#fff":"#9CA3AF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.65rem", fontWeight:700, flexShrink:0 }}>{i+1}</span>
                  <span style={{ fontSize:"0.85rem", fontWeight:600, color:"var(--navy)" }}>{r.nombre}</span>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontSize:"0.82rem", fontWeight:700, color:"var(--navy)" }}>{r.cantidad} uds</p>
                  <p style={{ fontSize:"0.72rem", color:"#9CA3AF" }}>{fmt(r.ingreso)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Ventas Table */}
          <div style={{ background:"#fff", borderRadius:"14px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,31,61,0.05)" }}>
            <div style={{ background:"var(--navy)", padding:"0.875rem 1.25rem", display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.78rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Detalle de Ventas</span>
              <span style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.4)" }}>{desde} — {hasta}</span>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#F9FAFB" }}>
                  {["Folio","Fecha","Cliente","Método","Total"].map(col => (
                    <th key={col} style={{ padding:"0.6rem 1rem", textAlign:col==="Total"?"right":"left", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.1em", textTransform:"uppercase" }}>{col}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {ventas.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding:"2rem", textAlign:"center", color:"#9CA3AF" }}>No hay ventas en este periodo</td></tr>
                  ) : ventas.map((v, i) => (
                    <tr key={v.id_venta} style={{ borderTop:"1px solid var(--border)", background:i%2===0?"#fff":"#FAFBFC" }}>
                      <td style={{ padding:"0.65rem 1rem", fontWeight:700, color:"var(--red)", fontSize:"0.85rem" }}>V-{String(v.id_venta).padStart(4,"0")}</td>
                      <td style={{ padding:"0.65rem 1rem", fontSize:"0.85rem", color:"#4B5563" }}>{new Date(v.fecha).toLocaleDateString("es-MX")}</td>
                      <td style={{ padding:"0.65rem 1rem", fontSize:"0.85rem", color:"var(--navy)", fontWeight:500 }}>{v.cliente}</td>
                      <td style={{ padding:"0.65rem 1rem", fontSize:"0.82rem", color:"#6B7280" }}>{METODO_LABEL[v.metodo_pago]}</td>
                      <td style={{ padding:"0.65rem 1rem", textAlign:"right", fontWeight:700, color:"var(--navy)" }}>{fmt(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
