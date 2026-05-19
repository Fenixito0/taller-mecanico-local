"use client"
import React, { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"

const LADO_COLORS = {
  izquierdo:{ bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE" },
  derecho:  { bg:"#F0FDF4", color:"#15803D", border:"#BBF7D0" },
  central:  { bg:"#FFF7ED", color:"#C2410C", border:"#FED7AA" },
  NA:       { bg:"#F9FAFB", color:"#6B7280", border:"#E5E7EB" },
}
const LADO_LABELS    = { izquierdo:"Izq", derecho:"Der", central:"Cen", NA:"N/A" }
const METODOS_PAGO   = [{ value:"efectivo", label:"Efectivo", icon:"💵" },{ value:"tarjeta", label:"Tarjeta", icon:"💳" },{ value:"transferencia", label:"Transferencia", icon:"🏦" }]

export default function CobrarVentaPage({ params }) {
  const router     = useRouter()
  const { id }     = React.use(params)
  const [orden, setOrden]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [metodoPago, setMetodoPago] = useState("efectivo")
  const [aplicaIva, setAplicaIva]   = useState(true)
  const [manoObra, setManoObra]     = useState("")
  const [efectivoRec, setEfectivoRec] = useState("")
  const [processing, setProcessing]   = useState(false)
  const [success, setSuccess]         = useState(false)
  const [error, setError]             = useState("")

  useEffect(() => {
    if (!id) return
    fetch(`/api/ordenes/${id}`)
      .then(r => { if (!r.ok) { setNotFound(true); setLoading(false); return null } return r.json() })
      .then(d => { if (d) { setOrden(d); setLoading(false) } })
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
      <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.5rem", fontWeight:700, color:"var(--navy)" }}>Orden no encontrada</p>
      <p style={{ color:"#9CA3AF", marginTop:"0.5rem" }}>La orden #{id} no existe o ya fue procesada.</p>
      <button onClick={() => router.push("/ordenes")} style={{ marginTop:"1.5rem", padding:"0.75rem 1.5rem", background:"var(--red)", color:"#fff", border:"none", borderRadius:"10px", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }}>Volver a Órdenes</button>
    </div>
  )

  const subtotal    = orden.refacciones.reduce((s, r) => s + r.precio_unitario * r.cantidad, 0)
  const manoObraNum = parseFloat(manoObra) || 0
  const base        = subtotal + manoObraNum
  const ivaAmt      = aplicaIva ? base * 0.16 : 0
  const total       = base + ivaAmt
  const efectivoNum = parseFloat(efectivoRec) || 0
  const cambio      = metodoPago==="efectivo"&&efectivoNum>total ? efectivoNum-total : 0
  const montoInsuf  = metodoPago==="efectivo"&&efectivoRec!==""&&efectivoNum<total

  const handleManoObra  = (v) => { if (v===""||/^\d*\.?\d{0,2}$/.test(v)) setManoObra(v) }
  const handleEfectivo  = (v) => { if (v===""||/^\d*\.?\d{0,2}$/.test(v)) setEfectivoRec(v) }

  const handleCobrar = async () => {
    if (montoInsuf) return
    setProcessing(true)
    setError("")
    try {
      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_orden:    orden.id_orden,
          rfc_cliente: orden.cliente.rfc,
          subtotal,
          mano_obra:   manoObraNum,
          iva:         ivaAmt,
          precio_total: total,
          metodo_pago: metodoPago,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Error al registrar la venta"); setProcessing(false); return }
      setSuccess(true)
    } catch {
      setError("Error de conexión")
      setProcessing(false)
    }
  }

  if (success) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
      <div style={{ textAlign:"center", animation:"slideUp 0.5s ease-out" }}>
        <div style={{ width:"90px", height:"90px", background:"#F0FDF4", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1.5rem", boxShadow:"0 8px 30px rgba(22,163,74,0.25)" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"2rem", fontWeight:700, color:"var(--navy)", marginBottom:"0.5rem" }}>¡Venta Registrada!</h2>
        <p style={{ color:"#6B7280" }}>Total cobrado: <strong style={{ color:"var(--red)" }}>${total.toFixed(2)} MXN</strong></p>
        <p style={{ color:"#9CA3AF", fontSize:"0.82rem", marginTop:"0.3rem" }}>La orden fue marcada como <strong style={{ color:"#15803D" }}>Completada</strong></p>
        <div style={{ display:"flex", gap:"0.75rem", marginTop:"1.5rem", justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={() => router.push(`/ventas/${id}/recibo`)} style={{ padding:"0.85rem 1.5rem", border:"none", borderRadius:"12px", background:"var(--red)", color:"#fff", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.9rem", letterSpacing:"0.1em", boxShadow:"0 4px 14px rgba(200,16,46,0.3)", display:"flex", alignItems:"center", gap:"0.5rem" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            VER RECIBO
          </button>
          <button onClick={() => { const a = document.createElement("a"); a.href = `/api/ordenes/${id}/excel`; a.download = ""; document.body.appendChild(a); a.click(); a.remove() }} style={{ padding:"0.85rem 1.5rem", border:"2px solid #15803D", borderRadius:"12px", background:"#F0FDF4", color:"#15803D", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.9rem", letterSpacing:"0.1em", display:"flex", alignItems:"center", gap:"0.5rem" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            DESCARGAR EXCEL
          </button>
          <button onClick={() => router.push("/ordenes")} style={{ padding:"0.85rem 1.5rem", border:"2px solid var(--border)", borderRadius:"12px", background:"#fff", color:"var(--navy)", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.9rem", letterSpacing:"0.1em" }}>
            VOLVER A ÓRDENES
          </button>
        </div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  )

  return (
    <>
      <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"2rem" }}>
        <button onClick={() => router.push("/ordenes")} style={{ width:"38px", height:"38px", border:"2px solid var(--border)", borderRadius:"10px", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--navy)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"2rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.04em" }}>COBRAR VENTA</h1>
          <p style={{ color:"#9CA3AF", fontSize:"0.875rem" }}>Orden #{String(orden.id_orden).padStart(4,"0")} · {new Date(orden.fecha_creacion).toLocaleDateString("es-MX",{ day:"2-digit", month:"long", year:"numeric" })}</p>
        </div>
      </div>

      {error&&<div style={{ background:"#FFF0F2", border:"1px solid var(--red)", borderRadius:"10px", padding:"0.875rem 1rem", color:"var(--red)", marginBottom:"1.25rem" }}>{error}</div>}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:"1.5rem", alignItems:"start" }}>
        <div>
          {/* Cliente + Vehículo */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginBottom:"1.25rem" }}>
            {[
              { label:"Cliente", icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, content:<><p style={{ fontWeight:700, fontSize:"0.95rem", color:"var(--navy)" }}>{orden.cliente.nombre} {orden.cliente.apellido_paterno} {orden.cliente.apellido_materno||""}</p><p style={{ fontSize:"0.75rem", color:"#9CA3AF", fontFamily:"monospace", marginTop:"0.2rem" }}>{orden.cliente.rfc}</p><p style={{ fontSize:"0.78rem", color:"#6B7280", marginTop:"0.4rem" }}>{orden.cliente.telefono}</p><p style={{ fontSize:"0.78rem", color:"#6B7280" }}>{orden.cliente.correo}</p></> },
              { label:"Vehículo", icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, content:<><p style={{ fontWeight:700, fontSize:"0.95rem", color:"var(--navy)" }}>{orden.vehiculo.marca} {orden.vehiculo.modelo}</p><p style={{ fontSize:"0.78rem", color:"#6B7280", marginTop:"0.2rem" }}>{orden.vehiculo.anio} · {orden.vehiculo.color}</p><div style={{ marginTop:"0.6rem", display:"inline-block", padding:"0.3rem 0.7rem", background:"var(--navy)", borderRadius:"7px" }}><span style={{ fontFamily:"monospace", fontSize:"0.82rem", color:"#fff", fontWeight:700, letterSpacing:"0.1em" }}>{orden.vehiculo.placas}</span></div></> },
            ].map(card=>(
              <div key={card.label} style={{ background:"#fff", borderRadius:"14px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,31,61,0.05)" }}>
                <div style={{ background:"var(--navy)", padding:"0.875rem 1.25rem", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                  {card.icon}
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.78rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em", textTransform:"uppercase" }}>{card.label}</span>
                </div>
                <div style={{ padding:"1rem 1.25rem" }}>{card.content}</div>
              </div>
            ))}
          </div>

          {/* Refacciones */}
          <div style={{ background:"#fff", borderRadius:"14px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,31,61,0.05)", marginBottom:"1.25rem" }}>
            <div style={{ background:"var(--navy)", padding:"0.875rem 1.25rem" }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.78rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Refacciones y Piezas</span>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ background:"#F9FAFB" }}>{["Refacción","Lado","Cant.","Precio","Subtotal"].map(col=><th key={col} style={{ padding:"0.6rem 1rem", textAlign:"left", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.1em", textTransform:"uppercase" }}>{col}</th>)}</tr></thead>
              <tbody>
                {orden.refacciones.map((r,i)=>{
                  const ls=LADO_COLORS[r.lado]||LADO_COLORS.NA
                  return(
                    <tr key={r.id_refaccion} style={{ borderTop:"1px solid var(--border)", background:i%2===0?"#fff":"#FAFBFC" }}>
                      <td style={{ padding:"0.75rem 1rem", fontSize:"0.9rem", fontWeight:600, color:"var(--navy)" }}>{r.nombre}</td>
                      <td style={{ padding:"0.75rem 1rem" }}><span style={{ background:ls.bg, color:ls.color, border:`1px solid ${ls.border}`, padding:"0.15rem 0.5rem", borderRadius:"4px", fontSize:"0.7rem", fontWeight:700 }}>{LADO_LABELS[r.lado]}</span></td>
                      <td style={{ padding:"0.75rem 1rem", textAlign:"center", fontWeight:700, color:"var(--navy)" }}>{r.cantidad}</td>
                      <td style={{ padding:"0.75rem 1rem", color:"#4B5563" }}>${r.precio_unitario.toFixed(2)}</td>
                      <td style={{ padding:"0.75rem 1rem", fontWeight:700, color:"var(--navy)" }}>${(r.precio_unitario*r.cantidad).toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Ajustes */}
          <div style={{ background:"#fff", borderRadius:"14px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,31,61,0.05)", marginBottom:"1.25rem" }}>
            <div style={{ background:"var(--navy)", padding:"0.875rem 1.25rem" }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.78rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Ajustes de Precio</span>
            </div>
            <div style={{ padding:"1.25rem", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
              <div>
                <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"var(--navy)", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.4rem", fontFamily:"'Barlow Condensed',sans-serif" }}>Mano de obra (MXN)</label>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:"1rem", top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>$</span>
                  <input value={manoObra} onChange={e=>handleManoObra(e.target.value)} placeholder="0.00" style={{ width:"100%", padding:"0.8rem 1rem 0.8rem 1.75rem", border:"2px solid var(--border)", borderRadius:"10px", fontSize:"0.9rem", color:"var(--navy)", fontFamily:"'Barlow',sans-serif" }} />
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center" }}>
                <div onClick={()=>setAplicaIva(!aplicaIva)} style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.875rem 1rem", background:"#F9FAFB", borderRadius:"10px", border:"1px solid var(--border)", cursor:"pointer", width:"100%" }}>
                  <div style={{ width:"44px", height:"24px", borderRadius:"12px", background:aplicaIva?"var(--red)":"#D1D5DB", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                    <div style={{ position:"absolute", top:"2px", left:aplicaIva?"22px":"2px", width:"20px", height:"20px", borderRadius:"50%", background:"#fff", boxShadow:"0 1px 4px rgba(0,0,0,0.2)", transition:"left 0.2s" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight:600, fontSize:"0.85rem", color:"var(--navy)" }}>IVA 16%</p>
                    <p style={{ fontSize:"0.72rem", color:"#9CA3AF" }}>{aplicaIva?`+$${ivaAmt.toFixed(2)}`:"Sin IVA"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Método de pago */}
          <div style={{ background:"#fff", borderRadius:"14px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 2px 12px rgba(15,31,61,0.05)" }}>
            <div style={{ background:"var(--navy)", padding:"0.875rem 1.25rem" }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.78rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Método de Pago</span>
            </div>
            <div style={{ padding:"1.25rem" }}>
              <div style={{ display:"flex", gap:"0.75rem", marginBottom:metodoPago==="efectivo"?"1rem":"0" }}>
                {METODOS_PAGO.map(m=>(
                  <button key={m.value} onClick={()=>setMetodoPago(m.value)} style={{ flex:1, padding:"0.875rem", borderRadius:"12px", border:`2px solid ${metodoPago===m.value?"var(--red)":"var(--border)"}`, background:metodoPago===m.value?"#FFF0F2":"#fff", cursor:"pointer", transition:"all 0.15s", textAlign:"center" }}>
                    <div style={{ fontSize:"1.4rem", marginBottom:"0.3rem" }}>{m.icon}</div>
                    <p style={{ fontSize:"0.82rem", fontWeight:700, color:metodoPago===m.value?"var(--red)":"var(--navy)", fontFamily:"'Barlow Condensed',sans-serif" }}>{m.label}</p>
                  </button>
                ))}
              </div>
              {metodoPago==="efectivo"&&(
                <div>
                  <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"var(--navy)", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.4rem", fontFamily:"'Barlow Condensed',sans-serif" }}>Efectivo recibido (MXN)</label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:"1rem", top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>$</span>
                    <input value={efectivoRec} onChange={e=>handleEfectivo(e.target.value)} placeholder={total.toFixed(2)} style={{ width:"100%", padding:"0.8rem 1rem 0.8rem 1.75rem", border:`2px solid ${montoInsuf?"var(--red)":"var(--border)"}`, borderRadius:"10px", fontSize:"0.9rem", color:"var(--navy)", fontFamily:"'Barlow',sans-serif" }} />
                  </div>
                  {efectivoRec!==""&&!montoInsuf&&efectivoNum>=total&&(
                    <div style={{ marginTop:"0.75rem", padding:"0.75rem 1rem", background:"#F0FDF4", borderRadius:"10px", border:"1px solid #BBF7D0", display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:"0.82rem", fontWeight:600, color:"#15803D" }}>Cambio a entregar</span>
                      <span style={{ fontSize:"1.1rem", fontWeight:800, color:"#15803D", fontFamily:"'Barlow Condensed',sans-serif" }}>${cambio.toFixed(2)}</span>
                    </div>
                  )}
                  {montoInsuf&&<div style={{ marginTop:"0.75rem", padding:"0.75rem 1rem", background:"#FFF0F2", borderRadius:"10px", border:"1px solid #FECDD3" }}><span style={{ fontSize:"0.82rem", fontWeight:600, color:"var(--red)" }}>Monto insuficiente — faltan ${(total-efectivoNum).toFixed(2)}</span></div>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel resumen */}
        <div style={{ position:"sticky", top:"80px" }}>
          <div style={{ background:"#fff", borderRadius:"16px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 8px 30px rgba(15,31,61,0.1)" }}>
            <div style={{ background:"var(--navy)", padding:"1.1rem 1.25rem" }}>
              <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1rem", fontWeight:700, color:"#fff", letterSpacing:"0.08em", textTransform:"uppercase" }}>Resumen de Cobro</h3>
            </div>
            <div style={{ height:"3px", background:"var(--red)" }} />
            <div style={{ padding:"1.25rem" }}>
              {[{ label:"Subtotal refacciones",value:`$${subtotal.toFixed(2)}` },{ label:"Mano de obra",value:`$${manoObraNum.toFixed(2)}` },{ label:"Base",value:`$${base.toFixed(2)}`,bold:true },{ label:"IVA (16%)",value:aplicaIva?`$${ivaAmt.toFixed(2)}`:"—",color:"#6B7280" }].map(row=>(
                <div key={row.label} style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.6rem" }}>
                  <span style={{ fontSize:"0.85rem", color:row.bold?"var(--navy)":"#6B7280", fontWeight:row.bold?700:400 }}>{row.label}</span>
                  <span style={{ fontSize:"0.85rem", fontWeight:row.bold?700:500, color:row.color||(row.bold?"var(--navy)":"#4B5563") }}>{row.value}</span>
                </div>
              ))}
              <div style={{ marginTop:"1rem", padding:"1rem", background:"var(--navy)", borderRadius:"12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.85rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em", textTransform:"uppercase" }}>TOTAL</span>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.6rem", fontWeight:800, color:"#fff" }}>${total.toFixed(2)}</span>
              </div>
              <p style={{ textAlign:"center", fontSize:"0.7rem", color:"#9CA3AF", marginTop:"0.4rem" }}>MXN · {METODOS_PAGO.find(m=>m.value===metodoPago)?.label}</p>
              <div style={{ marginTop:"1rem", padding:"0.75rem", background:"#F0FDF4", borderRadius:"10px", border:"1px solid #BBF7D0", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>
                <p style={{ fontSize:"0.75rem", color:"#15803D", fontWeight:500 }}>Al cobrar, la orden se marcará como <strong>Completada</strong></p>
              </div>
              <button onClick={handleCobrar} disabled={processing||montoInsuf} style={{ width:"100%", marginTop:"1rem", padding:"1rem", border:"none", borderRadius:"12px", background:processing||montoInsuf?"#9CA3AF":"var(--red)", color:"#fff", cursor:processing||montoInsuf?"not-allowed":"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1rem", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", boxShadow:processing||montoInsuf?"none":"0 6px 20px rgba(200,16,46,0.35)", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.6rem" }}
                onMouseEnter={e=>{ if (!processing&&!montoInsuf) e.currentTarget.style.background="var(--red-dark)" }}
                onMouseLeave={e=>{ if (!processing&&!montoInsuf) e.currentTarget.style.background="var(--red)" }}>
                {processing?<><span style={{ width:"18px", height:"18px", border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" }} />PROCESANDO...</>:<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>REGISTRAR COBRO</>}
              </button>
              <button onClick={()=>router.push("/ordenes")} style={{ width:"100%", marginTop:"0.5rem", padding:"0.75rem", border:"2px solid var(--border)", borderRadius:"12px", background:"#fff", color:"#9CA3AF", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.82rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>CANCELAR</button>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
