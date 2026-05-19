"use client"
import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const LADO_LABELS  = { izquierdo:"Izq", derecho:"Der", central:"Cen", NA:"N/A" }
const METODO_LABEL = { efectivo:"Efectivo", tarjeta:"Tarjeta", transferencia:"Transferencia" }
const METODO_ICON  = { efectivo:"💵", tarjeta:"💳", transferencia:"🏦" }

export default function ReciboVentaPage({ params }) {
  const router = useRouter()
  const { id } = React.use(params)
  const [venta, setVenta]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/ventas/${id}`)
      .then(r => { if (!r.ok) { setNotFound(true); setLoading(false); return null } return r.json() })
      .then(d => { if (d) { setVenta(d); setLoading(false) } })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [id])

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
      <span style={{ display:"inline-block", width:"36px", height:"36px", border:"3px solid var(--border)", borderTopColor:"var(--red)", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (notFound) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", textAlign:"center" }}>
      <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.5rem", fontWeight:700, color:"var(--navy)" }}>Venta no encontrada</p>
      <p style={{ color:"#9CA3AF", marginTop:"0.5rem" }}>No se encontró un recibo para la orden #{id}.</p>
      <button onClick={() => router.push("/ordenes")} style={{ marginTop:"1.5rem", padding:"0.75rem 1.5rem", background:"var(--red)", color:"#fff", border:"none", borderRadius:"10px", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }}>Volver a Órdenes</button>
    </div>
  )

  const fechaVenta = new Date(venta.fecha_venta).toLocaleDateString("es-MX", { day:"2-digit", month:"long", year:"numeric" })
  const horaVenta  = new Date(venta.fecha_venta).toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit" })
  const base       = venta.subtotal + venta.mano_obra

  return (
    <>
      {/* Toolbar - hidden on print */}
      <div className="no-print" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.5rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
          <button onClick={() => router.push("/ordenes")} style={{ width:"38px", height:"38px", border:"2px solid var(--border)", borderRadius:"10px", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--navy)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.75rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.04em" }}>RECIBO DE VENTA</h1>
            <p style={{ color:"#9CA3AF", fontSize:"0.82rem" }}>Orden #{String(venta.id_orden).padStart(4,"0")}</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:"0.75rem" }}>
          <button onClick={() => router.push("/ordenes")} style={{ padding:"0.7rem 1.25rem", border:"2px solid var(--border)", borderRadius:"10px", background:"#fff", color:"var(--navy)", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.85rem", letterSpacing:"0.08em" }}>VOLVER</button>
          <button onClick={() => { const a = document.createElement("a"); a.href = `/api/ordenes/${id}/excel`; a.download = ""; document.body.appendChild(a); a.click(); a.remove() }} style={{ padding:"0.7rem 1.25rem", border:"2px solid #15803D", borderRadius:"10px", background:"#F0FDF4", color:"#15803D", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.85rem", letterSpacing:"0.08em", display:"flex", alignItems:"center", gap:"0.5rem" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            EXCEL
          </button>
          <button onClick={() => window.print()} style={{ padding:"0.7rem 1.5rem", border:"none", borderRadius:"10px", background:"var(--red)", color:"#fff", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.85rem", letterSpacing:"0.08em", boxShadow:"0 4px 14px rgba(200,16,46,0.3)", display:"flex", alignItems:"center", gap:"0.5rem" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            IMPRIMIR
          </button>
        </div>
      </div>

      {/* Receipt */}
      <div id="recibo" style={{ maxWidth:"800px", margin:"0 auto", background:"#fff", borderRadius:"16px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 4px 24px rgba(15,31,61,0.08)" }}>

        {/* Header */}
        <div style={{ background:"var(--navy)", padding:"2rem 2.5rem", textAlign:"center", position:"relative" }}>
          <div style={{ height:"3px", background:"var(--red)", position:"absolute", top:0, left:0, right:0 }} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"0.75rem", marginBottom:"0.5rem" }}>
            <div style={{ width:"40px", height:"40px", background:"var(--red)", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div>
              <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.3rem", fontWeight:800, color:"#fff", letterSpacing:"0.1em" }}>TALLER MECÁNICO</p>
              <p style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.4)", letterSpacing:"0.18em" }}>SISTEMA DE GESTIÓN</p>
            </div>
          </div>
          <div style={{ marginTop:"1rem", padding:"0.6rem 1.5rem", background:"rgba(200,16,46,0.2)", borderRadius:"8px", display:"inline-block" }}>
            <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1rem", fontWeight:700, color:"#fff", letterSpacing:"0.12em" }}>RECIBO DE VENTA</p>
          </div>
        </div>

        {/* Folio + Fecha */}
        <div style={{ display:"flex", justifyContent:"space-between", padding:"1.25rem 2.5rem", background:"#F9FAFB", borderBottom:"1px solid var(--border)" }}>
          <div>
            <span style={{ fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Folio</span>
            <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.2rem", fontWeight:800, color:"var(--red)" }}>V-{String(venta.id_venta).padStart(4,"0")}</p>
          </div>
          <div style={{ textAlign:"center" }}>
            <span style={{ fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Orden</span>
            <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.2rem", fontWeight:800, color:"var(--navy)" }}>#{String(venta.id_orden).padStart(4,"0")}</p>
          </div>
          <div style={{ textAlign:"right" }}>
            <span style={{ fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Fecha</span>
            <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1rem", fontWeight:700, color:"var(--navy)" }}>{fechaVenta}</p>
            <p style={{ fontSize:"0.78rem", color:"#6B7280" }}>{horaVenta}</p>
          </div>
        </div>

        <div style={{ padding:"2rem 2.5rem" }}>
          {/* Cliente + Vehículo */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem", marginBottom:"2rem" }}>
            <div style={{ padding:"1rem 1.25rem", border:"1px solid var(--border)", borderRadius:"12px", background:"#FAFBFC" }}>
              <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.7rem", fontWeight:700, color:"var(--red)", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"0.6rem" }}>CLIENTE</p>
              <p style={{ fontWeight:700, fontSize:"0.95rem", color:"var(--navy)" }}>{venta.cliente.nombre} {venta.cliente.apellido_paterno} {venta.cliente.apellido_materno || ""}</p>
              <p style={{ fontSize:"0.78rem", color:"#6B7280", fontFamily:"monospace", marginTop:"0.25rem" }}>RFC: {venta.cliente.rfc}</p>
              {venta.cliente.telefono && <p style={{ fontSize:"0.78rem", color:"#6B7280", marginTop:"0.15rem" }}>Tel: {venta.cliente.telefono}</p>}
              {venta.cliente.correo && <p style={{ fontSize:"0.78rem", color:"#6B7280", marginTop:"0.15rem" }}>{venta.cliente.correo}</p>}
            </div>
            <div style={{ padding:"1rem 1.25rem", border:"1px solid var(--border)", borderRadius:"12px", background:"#FAFBFC" }}>
              <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.7rem", fontWeight:700, color:"var(--red)", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"0.6rem" }}>VEHÍCULO</p>
              <p style={{ fontWeight:700, fontSize:"0.95rem", color:"var(--navy)" }}>{venta.vehiculo.marca} {venta.vehiculo.modelo}</p>
              <p style={{ fontSize:"0.78rem", color:"#6B7280", marginTop:"0.25rem" }}>Año: {venta.vehiculo.anio} {venta.vehiculo.color ? `· ${venta.vehiculo.color}` : ""}</p>
              <div style={{ marginTop:"0.5rem", display:"inline-block", padding:"0.25rem 0.6rem", background:"var(--navy)", borderRadius:"6px" }}>
                <span style={{ fontFamily:"monospace", fontSize:"0.8rem", color:"#fff", fontWeight:700, letterSpacing:"0.1em" }}>{venta.vehiculo.placas}</span>
              </div>
            </div>
          </div>

          {/* Tabla de Refacciones */}
          <div style={{ marginBottom:"2rem" }}>
            <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.7rem", fontWeight:700, color:"var(--red)", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"0.75rem" }}>REFACCIONES Y PIEZAS</p>
            <table style={{ width:"100%", borderCollapse:"collapse", border:"1px solid var(--border)", borderRadius:"10px", overflow:"hidden" }}>
              <thead>
                <tr style={{ background:"var(--navy)" }}>
                  {["#","Refacción","Lado","Cant.","P. Unitario","Subtotal"].map(col => (
                    <th key={col} style={{ padding:"0.7rem 1rem", textAlign:col==="Cant."||col==="P. Unitario"||col==="Subtotal"?"right":"left", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.7rem", fontWeight:700, color:"rgba(255,255,255,0.8)", letterSpacing:"0.1em", textTransform:"uppercase" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {venta.refacciones.map((r, i) => (
                  <tr key={r.id_refaccion} style={{ borderTop:"1px solid var(--border)", background:i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                    <td style={{ padding:"0.65rem 1rem", fontSize:"0.8rem", color:"#9CA3AF", fontWeight:600 }}>{i + 1}</td>
                    <td style={{ padding:"0.65rem 1rem", fontSize:"0.88rem", fontWeight:600, color:"var(--navy)" }}>{r.nombre}</td>
                    <td style={{ padding:"0.65rem 1rem", fontSize:"0.78rem", color:"#6B7280" }}>{LADO_LABELS[r.lado]}</td>
                    <td style={{ padding:"0.65rem 1rem", textAlign:"right", fontWeight:700, color:"var(--navy)" }}>{r.cantidad}</td>
                    <td style={{ padding:"0.65rem 1rem", textAlign:"right", color:"#4B5563" }}>${r.precio_unitario.toFixed(2)}</td>
                    <td style={{ padding:"0.65rem 1rem", textAlign:"right", fontWeight:700, color:"var(--navy)" }}>${(r.precio_unitario * r.cantidad).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resumen Financiero */}
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"2rem" }}>
            <div style={{ width:"320px" }}>
              {[
                { label:"Subtotal refacciones", value:`$${venta.subtotal.toFixed(2)}` },
                { label:"Mano de obra", value:`$${venta.mano_obra.toFixed(2)}` },
                { label:"Base", value:`$${base.toFixed(2)}`, bold:true, border:true },
                { label:"IVA (16%)", value:venta.iva > 0 ? `$${venta.iva.toFixed(2)}` : "—" },
              ].map(row => (
                <div key={row.label} style={{ display:"flex", justifyContent:"space-between", padding:"0.5rem 0", borderTop:row.border ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize:"0.85rem", color:row.bold ? "var(--navy)" : "#6B7280", fontWeight:row.bold ? 700 : 400 }}>{row.label}</span>
                  <span style={{ fontSize:"0.85rem", fontWeight:row.bold ? 700 : 500, color:row.bold ? "var(--navy)" : "#4B5563" }}>{row.value}</span>
                </div>
              ))}
              <div style={{ marginTop:"0.75rem", padding:"1rem 1.25rem", background:"var(--navy)", borderRadius:"10px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.85rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em" }}>TOTAL</span>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.5rem", fontWeight:800, color:"#fff" }}>${venta.precio_total.toFixed(2)} <span style={{ fontSize:"0.7rem", fontWeight:400, color:"rgba(255,255,255,0.5)" }}>MXN</span></span>
              </div>
            </div>
          </div>

          {/* Método de Pago + Estado */}
          <div style={{ display:"flex", gap:"1rem", marginBottom:"2rem" }}>
            <div style={{ flex:1, padding:"1rem 1.25rem", border:"1px solid var(--border)", borderRadius:"10px", background:"#F9FAFB", display:"flex", alignItems:"center", gap:"0.75rem" }}>
              <span style={{ fontSize:"1.5rem" }}>{METODO_ICON[venta.metodo_pago]}</span>
              <div>
                <p style={{ fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Método de pago</p>
                <p style={{ fontWeight:700, color:"var(--navy)", fontSize:"0.95rem" }}>{METODO_LABEL[venta.metodo_pago]}</p>
              </div>
            </div>
            <div style={{ flex:1, padding:"1rem 1.25rem", border:"1px solid #BBF7D0", borderRadius:"10px", background:"#F0FDF4", display:"flex", alignItems:"center", gap:"0.75rem" }}>
              <div style={{ width:"32px", height:"32px", background:"#DCFCE7", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <p style={{ fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Estado</p>
                <p style={{ fontWeight:700, color:"#15803D", fontSize:"0.95rem" }}>Pagado</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop:"2px solid var(--border)", paddingTop:"1.5rem", textAlign:"center" }}>
            <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.05em" }}>¡Gracias por su preferencia!</p>
            <p style={{ fontSize:"0.78rem", color:"#9CA3AF", marginTop:"0.3rem" }}>Conserve este recibo como comprobante de pago.</p>
            <div style={{ marginTop:"1rem", display:"flex", justifyContent:"center", gap:"2rem", fontSize:"0.7rem", color:"#D1D5DB" }}>
              <span>Folio: V-{String(venta.id_venta).padStart(4,"0")}</span>
              <span>Orden: #{String(venta.id_orden).padStart(4,"0")}</span>
              <span>Impreso: {new Date().toLocaleDateString("es-MX")} {new Date().toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit" })}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
