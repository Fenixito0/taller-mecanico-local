"use client"
import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const LADO_LABELS  = { izquierdo:"Izq", derecho:"Der", central:"Cen", NA:"N/A" }
const METODO_LABEL = { efectivo:"Efectivo", tarjeta:"Tarjeta", transferencia:"Transferencia" }

const F = "'Courier New', Courier, monospace"
const DASH = "- - - - - - - - - - - - - - - - - - - -"

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

  const fechaVenta = new Date(venta.fecha_venta).toLocaleDateString("es-MX", { day:"2-digit", month:"2-digit", year:"numeric" })
  const horaVenta  = new Date(venta.fecha_venta).toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit", second:"2-digit" })
  const base       = venta.subtotal + venta.mano_obra
  const nombreCliente = [venta.cliente.nombre, venta.cliente.apellido_paterno, venta.cliente.apellido_materno].filter(Boolean).join(" ")

  const pad = (str, len, right) => {
    const s = String(str)
    if (right) return s.length >= len ? s : " ".repeat(len - s.length) + s
    return s.length >= len ? s : s + " ".repeat(len - s.length)
  }

  return (
    <>
      {/* Toolbar */}
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

      {/* Ticket Receipt */}
      <div id="recibo" style={{ width:"80mm", margin:"0 auto", background:"#fff", padding:"8mm 6mm", fontFamily:F, fontSize:"12px", lineHeight:"1.5", color:"#000", border:"1px dashed #ccc", boxShadow:"0 2px 16px rgba(0,0,0,0.08)" }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:"2mm" }}>
          <p style={{ fontSize:"18px", fontWeight:"bold", letterSpacing:"2px" }}>TALLER MECANICO</p>
          <p style={{ fontSize:"10px", letterSpacing:"1px" }}>SISTEMA DE GESTION</p>
          <p style={{ fontSize:"10px", marginTop:"2mm" }}>RFC: XAXX010101000</p>
          <p style={{ fontSize:"9px", marginTop:"1mm", color:"#555" }}>{DASH}</p>
          <p style={{ fontSize:"14px", fontWeight:"bold", marginTop:"1mm" }}>RECIBO DE VENTA</p>
          <p style={{ fontSize:"9px", color:"#555" }}>{DASH}</p>
        </div>

        {/* Folio + Fecha */}
        <div style={{ marginBottom:"3mm" }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span>Folio:</span>
            <span style={{ fontWeight:"bold" }}>V-{String(venta.id_venta).padStart(4,"0")}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span>Orden:</span>
            <span style={{ fontWeight:"bold" }}>#{String(venta.id_orden).padStart(4,"0")}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span>Fecha:</span>
            <span>{fechaVenta} {horaVenta}</span>
          </div>
        </div>

        <p style={{ fontSize:"9px", color:"#555", textAlign:"center" }}>{DASH}</p>

        {/* Cliente */}
        <div style={{ marginBottom:"3mm", marginTop:"2mm" }}>
          <p style={{ fontWeight:"bold", fontSize:"11px", marginBottom:"1mm" }}>CLIENTE</p>
          <p>{nombreCliente}</p>
          <p>RFC: {venta.cliente.rfc}</p>
          {venta.cliente.telefono && <p>Tel: {venta.cliente.telefono}</p>}
        </div>

        {/* Vehículo */}
        <div style={{ marginBottom:"2mm" }}>
          <p style={{ fontWeight:"bold", fontSize:"11px", marginBottom:"1mm" }}>VEHICULO</p>
          <p>{venta.vehiculo.marca} {venta.vehiculo.modelo} {venta.vehiculo.anio}</p>
          <p>Placas: {venta.vehiculo.placas}{venta.vehiculo.color ? `  Color: ${venta.vehiculo.color}` : ""}</p>
        </div>

        <p style={{ fontSize:"9px", color:"#555", textAlign:"center" }}>{DASH}</p>

        {/* Items */}
        <div style={{ marginTop:"2mm", marginBottom:"2mm" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontWeight:"bold", fontSize:"11px", borderBottom:"1px solid #000", paddingBottom:"1mm", marginBottom:"1mm" }}>
            <span>DESCRIPCION</span>
            <span>IMPORTE</span>
          </div>
          {venta.refacciones.map((r, i) => (
            <div key={r.id_refaccion} style={{ marginBottom:"2mm" }}>
              <p style={{ fontWeight:"bold" }}>{r.nombre} <span style={{ fontWeight:"normal", fontSize:"10px" }}>({LADO_LABELS[r.lado]})</span></p>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:"#333" }}>
                <span>  {r.cantidad} x ${r.precio_unitario.toFixed(2)}</span>
                <span style={{ fontWeight:"bold", color:"#000" }}>${(r.precio_unitario * r.cantidad).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize:"9px", color:"#555", textAlign:"center" }}>{DASH}</p>

        {/* Totals */}
        <div style={{ marginTop:"2mm", marginBottom:"2mm" }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span>Subtotal:</span>
            <span>${venta.subtotal.toFixed(2)}</span>
          </div>
          {venta.mano_obra > 0 && (
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span>Mano de obra:</span>
              <span>${venta.mano_obra.toFixed(2)}</span>
            </div>
          )}
          {venta.iva > 0 && (
            <>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span>Base:</span>
                <span>${base.toFixed(2)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span>IVA (16%):</span>
                <span>${venta.iva.toFixed(2)}</span>
              </div>
            </>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", fontWeight:"bold", fontSize:"16px", borderTop:"2px solid #000", marginTop:"2mm", paddingTop:"2mm" }}>
            <span>TOTAL:</span>
            <span>${venta.precio_total.toFixed(2)}</span>
          </div>
        </div>

        <p style={{ fontSize:"9px", color:"#555", textAlign:"center" }}>{DASH}</p>

        {/* Payment */}
        <div style={{ marginTop:"2mm", marginBottom:"2mm" }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span>Metodo de pago:</span>
            <span style={{ fontWeight:"bold" }}>{METODO_LABEL[venta.metodo_pago]}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span>Estado:</span>
            <span style={{ fontWeight:"bold" }}>PAGADO</span>
          </div>
        </div>

        <p style={{ fontSize:"9px", color:"#555", textAlign:"center" }}>{DASH}</p>

        {/* Footer */}
        <div style={{ textAlign:"center", marginTop:"4mm" }}>
          <p style={{ fontWeight:"bold", fontSize:"13px" }}>*** GRACIAS POR SU ***</p>
          <p style={{ fontWeight:"bold", fontSize:"13px" }}>*** PREFERENCIA ***</p>
          <p style={{ fontSize:"10px", marginTop:"3mm", color:"#555" }}>Conserve este ticket como</p>
          <p style={{ fontSize:"10px", color:"#555" }}>comprobante de pago</p>
          <p style={{ fontSize:"9px", marginTop:"4mm", color:"#999" }}>Impreso: {new Date().toLocaleDateString("es-MX")} {new Date().toLocaleTimeString("es-MX",{ hour:"2-digit", minute:"2-digit" })}</p>
          <p style={{ fontSize:"9px", color:"#999" }}>Folio: V-{String(venta.id_venta).padStart(4,"0")} | Orden: #{String(venta.id_orden).padStart(4,"0")}</p>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
