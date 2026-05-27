"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const LADO_COLORS = {
  izquierdo:{ bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE" },
  derecho:  { bg:"#F0FDF4", color:"#15803D", border:"#BBF7D0" },
  central:  { bg:"#FFF7ED", color:"#C2410C", border:"#FED7AA" },
  NA:       { bg:"#F9FAFB", color:"#6B7280", border:"#E5E7EB" },
}
const LADO_LABELS = { izquierdo:"Izq", derecho:"Der", central:"Cen", NA:"N/A" }

function StepIndicator({ step }) {
  const steps = [{ num:1, label:"Cliente" },{ num:2, label:"Vehículo" },{ num:3, label:"Refacciones" },{ num:4, label:"Confirmar" }]
  return (
    <div style={{ display:"flex", alignItems:"center", marginBottom:"2.5rem" }}>
      {steps.map((s, i) => (
        <div key={s.num} style={{ display:"flex", alignItems:"center", flex:i<steps.length-1?1:"none" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.35rem" }}>
            <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:step>s.num?"var(--navy)":step===s.num?"var(--red)":"#E5E7EB", color:step>=s.num?"#fff":"#9CA3AF", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.95rem", fontWeight:700, transition:"all 0.3s", boxShadow:step===s.num?"0 4px 14px rgba(200,16,46,0.4)":"none" }}>
              {step>s.num?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>:s.num}
            </div>
            <span style={{ fontSize:"0.68rem", fontWeight:600, color:step>=s.num?"var(--navy)":"#9CA3AF", letterSpacing:"0.06em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", whiteSpace:"nowrap" }}>{s.label}</span>
          </div>
          {i<steps.length-1&&<div style={{ flex:1, height:"2px", background:step>s.num?"var(--navy)":"#E5E7EB", margin:"0 0.5rem 1.4rem", transition:"background 0.3s" }} />}
        </div>
      ))}
    </div>
  )
}

function SectionCard({ title, icon, children }) {
  return (
    <div style={{ background:"#fff", borderRadius:"16px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 4px 20px rgba(15,31,61,0.06)", marginBottom:"1.5rem" }}>
      <div style={{ padding:"1rem 1.5rem", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"0.6rem", background:"#FAFAFA" }}>
        <span style={{ fontSize:"1.1rem" }}>{icon}</span>
        <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.9rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.1em", textTransform:"uppercase" }}>{title}</h3>
      </div>
      <div style={{ padding:"1.5rem" }}>{children}</div>
    </div>
  )
}

export default function NuevaOrdenPage() {
  const router = useRouter()
  const [step, setStep]                   = useState(1)
  const [cliente, setCliente]             = useState(null)
  const [vehiculo, setVehiculo]           = useState(null)
  const [refacciones, setRefacciones]     = useState([])
  const [observaciones, setObservaciones] = useState("")
  const [saving, setSaving]               = useState(false)
  const [success, setSuccess]             = useState(false)
  const [error, setError]                 = useState("")

  // Datos de la BD
  const [clientes, setClientes]         = useState([])
  const [vehiculosBD, setVehiculosBD]   = useState([])
  const [refaccionesBD, setRefaccionesBD] = useState([])
  const [loadingClientes, setLoadingClientes]     = useState(true)
  const [loadingVehiculos, setLoadingVehiculos]   = useState(false)
  const [loadingRefacciones, setLoadingRefacciones] = useState(true)
  const [searchCliente, setSearchCliente]   = useState("")
  const [searchRefaccion, setSearchRefaccion] = useState("")

  useEffect(() => {
    fetch("/api/clientes").then(r => r.json()).then(d => { setClientes(d); setLoadingClientes(false) })
    fetch("/api/refacciones").then(r => r.json()).then(d => { setRefaccionesBD(d); setLoadingRefacciones(false) })
  }, [])

  const selectCliente = (c) => {
    setCliente(c)
    setVehiculo(null)
    setLoadingVehiculos(true)
    fetch(`/api/vehiculos?rfc=${c.rfc}`).then(r => r.json()).then(d => { setVehiculosBD(d); setLoadingVehiculos(false) })
  }

  const toggleRefaccion = (r) => {
    setRefacciones(rs => {
      if (rs.find(s => s.id_refaccion === r.id_refaccion)) return rs.filter(s => s.id_refaccion !== r.id_refaccion)
      return [...rs, { ...r, cantidad:1 }]
    })
  }

  const canNext = () => {
    if (step===1) return !!cliente
    if (step===2) return !!vehiculo
    if (step===3) return refacciones.length > 0
    return true
  }

  const handleGenerar = async () => {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_vehiculo:  vehiculo.id_vehiculo,
          rfc_cliente:  cliente.rfc,
          observaciones,
          refacciones: refacciones.map(r => ({
            id_refaccion:    r.id_refaccion,
            cantidad:        r.cantidad,
            precio_unitario: Number(r.precio_unitario),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Error al generar la orden"); setSaving(false); return }
      setSuccess(true)
      setTimeout(() => router.push("/ordenes"), 2000)
    } catch {
      setError("Error de conexión")
      setSaving(false)
    }
  }

  const filteredClientes    = clientes.filter(c => `${c.nombre} ${c.apellido_paterno} ${c.apellido_materno} ${c.rfc}`.toLowerCase().includes(searchCliente.toLowerCase()))
  const filteredRefacciones = refaccionesBD.filter(r => `${r.nombre} ${r.descripcion||""}`.toLowerCase().includes(searchRefaccion.toLowerCase()))
  const subtotal            = refacciones.reduce((s, r) => s + Number(r.precio_unitario) * r.cantidad, 0)

  if (success) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
      <div style={{ textAlign:"center", animation:"slideUp 0.5s ease-out" }}>
        <div style={{ width:"80px", height:"80px", background:"#F0FDF4", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1.5rem", boxShadow:"0 8px 30px rgba(22,163,74,0.2)" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.8rem", fontWeight:700, color:"var(--navy)", marginBottom:"0.5rem" }}>¡Orden Generada!</h2>
        <p style={{ color:"#9CA3AF" }}>Redirigiendo a la lista de órdenes...</p>
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
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"2rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.04em" }}>GENERAR LISTA DE SERVICIO</h1>
          <p style={{ color:"#9CA3AF", fontSize:"0.875rem" }}>Vincula cliente, vehículo y refacciones</p>
        </div>
      </div>

      <StepIndicator step={step} />

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:"1.5rem", alignItems:"start" }}>
        <div>
          {/* Paso 1: Cliente */}
          {step===1 && (
            <SectionCard title="Seleccionar Cliente" icon="👤">
              <div style={{ position:"relative", marginBottom:"1.25rem" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ position:"absolute", left:"1rem", top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={searchCliente} onChange={e => setSearchCliente(e.target.value)} placeholder="Buscar cliente..." style={{ width:"100%", padding:"0.8rem 1rem 0.8rem 2.75rem", border:"2px solid var(--border)", borderRadius:"10px", fontSize:"0.9rem", color:"var(--navy)", fontFamily:"'Barlow',sans-serif" }} />
              </div>
              {loadingClientes ? <p style={{ textAlign:"center", color:"#9CA3AF" }}>Cargando clientes...</p> : (
                <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem" }}>
                  {filteredClientes.map(c => (
                    <div key={c.rfc} onClick={() => selectCliente(c)} style={{ padding:"1rem 1.25rem", borderRadius:"12px", border:`2px solid ${cliente?.rfc===c.rfc?"var(--red)":"var(--border)"}`, background:cliente?.rfc===c.rfc?"#FFF0F2":"#fff", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div>
                        <p style={{ fontWeight:600, fontSize:"0.92rem", color:"var(--navy)" }}>{c.nombre} {c.apellido_paterno} {c.apellido_materno}</p>
                        <span style={{ fontSize:"0.75rem", color:"#9CA3AF", fontFamily:"monospace" }}>RFC: {c.rfc}</span>
                      </div>
                      {cliente?.rfc===c.rfc&&<div style={{ width:"24px", height:"24px", borderRadius:"50%", background:"var(--red)", display:"flex", alignItems:"center", justifyContent:"center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
                    </div>
                  ))}
                  {filteredClientes.length===0&&<p style={{ color:"#9CA3AF", textAlign:"center", padding:"1rem" }}>No se encontraron clientes</p>}
                </div>
              )}
            </SectionCard>
          )}

          {/* Paso 2: Vehículo */}
          {step===2&&cliente&&(
            <SectionCard title="Seleccionar Vehículo" icon="🚗">
              {loadingVehiculos ? <p style={{ textAlign:"center", color:"#9CA3AF" }}>Cargando vehículos...</p> : vehiculosBD.length===0 ? (
                <div style={{ textAlign:"center", padding:"2rem", color:"#9CA3AF" }}>
                  <p>Este cliente no tiene vehículos registrados.</p>
                  <p style={{ fontSize:"0.82rem", marginTop:"0.5rem" }}>Regístralo primero en el módulo de Vehículos.</p>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:"0.75rem" }}>
                  {vehiculosBD.map(v => (
                    <div key={v.id_vehiculo} onClick={() => setVehiculo(v)} style={{ padding:"1.1rem", borderRadius:"12px", border:`2px solid ${vehiculo?.id_vehiculo===v.id_vehiculo?"var(--red)":"var(--border)"}`, background:vehiculo?.id_vehiculo===v.id_vehiculo?"#FFF0F2":"#fff", cursor:"pointer", transition:"all 0.2s" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div>
                          <p style={{ fontWeight:700, fontSize:"0.95rem", color:"var(--navy)" }}>{v.marca} {v.modelo}</p>
                          <p style={{ fontSize:"0.78rem", color:"#9CA3AF", marginTop:"0.15rem" }}>{v.anio} · {v.color}</p>
                        </div>
                        {vehiculo?.id_vehiculo===v.id_vehiculo&&<div style={{ width:"22px", height:"22px", borderRadius:"50%", background:"var(--red)", display:"flex", alignItems:"center", justifyContent:"center" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
                      </div>
                      <div style={{ marginTop:"0.75rem", padding:"0.3rem 0.7rem", background:"var(--navy)", borderRadius:"7px", display:"inline-block" }}>
                        <span style={{ fontFamily:"monospace", fontSize:"0.8rem", color:"#fff", fontWeight:700, letterSpacing:"0.08em" }}>{v.placas}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Paso 3: Refacciones */}
          {step===3&&(
            <>
              <SectionCard title="Seleccionar Refacciones" icon="🔩">
                <div style={{ position:"relative", marginBottom:"1.25rem" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ position:"absolute", left:"1rem", top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input value={searchRefaccion} onChange={e => setSearchRefaccion(e.target.value)} placeholder="Buscar refacción..." style={{ width:"100%", maxWidth:"320px", padding:"0.8rem 1rem 0.8rem 2.75rem", border:"2px solid var(--border)", borderRadius:"10px", fontSize:"0.875rem", color:"var(--navy)", fontFamily:"'Barlow',sans-serif" }} />
                </div>
                {loadingRefacciones ? <p style={{ textAlign:"center", color:"#9CA3AF" }}>Cargando catálogo...</p> : (
                  <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
                    {filteredRefacciones.map(r => {
                      const sel = refacciones.find(s => s.id_refaccion===r.id_refaccion)
                      const ls  = LADO_COLORS[r.lado]||LADO_COLORS.NA
                      const sinStock = (r.stock ?? 0) <= 0
                      return (
                        <div key={r.id_refaccion} style={{ padding:"0.9rem 1.1rem", borderRadius:"10px", border:`2px solid ${sel?"var(--red)":sinStock?"#E5E7EB":"var(--border)"}`, background:sel?"#FFF0F2":sinStock?"#F3F4F6":"#FAFAFA", transition:"all 0.15s", display:"flex", alignItems:"center", gap:"1rem", opacity:sinStock?0.5:1 }}>
                          <div onClick={() => !sinStock && toggleRefaccion(r)} style={{ width:"22px", height:"22px", borderRadius:"6px", flexShrink:0, border:`2px solid ${sel?"var(--red)":sinStock?"#D1D5DB":"#D1D5DB"}`, background:sel?"var(--red)":"#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:sinStock?"not-allowed":"pointer", transition:"all 0.15s" }}>
                            {sel&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <div style={{ flex:1, cursor:sinStock?"not-allowed":"pointer" }} onClick={() => !sinStock && toggleRefaccion(r)}>
                            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                              <span style={{ fontWeight:600, fontSize:"0.9rem", color:sinStock?"#9CA3AF":"var(--navy)" }}>{r.nombre}</span>
                              <span style={{ background:ls.bg, color:ls.color, border:`1px solid ${ls.border}`, padding:"0.1rem 0.5rem", borderRadius:"4px", fontSize:"0.68rem", fontWeight:700 }}>{LADO_LABELS[r.lado]}</span>
                              {sinStock && <span style={{ background:"#FFF0F2", color:"#C8102E", border:"1px solid #FECDD3", padding:"0.1rem 0.5rem", borderRadius:"4px", fontSize:"0.65rem", fontWeight:700 }}>ASIGNADA</span>}
                            </div>
                            {r.descripcion&&<p style={{ fontSize:"0.78rem", color:"#9CA3AF", marginTop:"0.1rem" }}>{r.descripcion}</p>}
                          </div>
                          <span style={{ fontWeight:700, color:sinStock?"#9CA3AF":"var(--navy)", fontSize:"0.9rem", whiteSpace:"nowrap" }}>${Number(r.precio_unitario).toFixed(2)}</span>
                          {sel&&(
                            <span style={{ fontSize:"0.72rem", fontWeight:700, color:"#15803D", background:"#F0FDF4", border:"1px solid #BBF7D0", padding:"0.2rem 0.6rem", borderRadius:"6px" }}>Seleccionada</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Observaciones" icon="📝">
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Notas adicionales..." rows={3} style={{ width:"100%", padding:"0.9rem 1rem", border:"2px solid var(--border)", borderRadius:"10px", fontSize:"0.9rem", color:"var(--navy)", fontFamily:"'Barlow',sans-serif", resize:"vertical", lineHeight:1.6 }} />
              </SectionCard>
            </>
          )}

          {/* Paso 4: Confirmar */}
          {step===4&&cliente&&vehiculo&&(
            <>
              {error&&<div style={{ background:"#FFF0F2", border:"1px solid var(--red)", borderRadius:"10px", padding:"0.875rem 1rem", color:"var(--red)", marginBottom:"1rem" }}>{error}</div>}
              <SectionCard title="Resumen del Cliente" icon="👤">
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem 2rem" }}>
                  {[["Nombre",`${cliente.nombre} ${cliente.apellido_paterno} ${cliente.apellido_materno||""}`],["RFC",cliente.rfc],["Teléfono",cliente.telefono||"—"],["Correo",cliente.correo||"—"]].map(([k,v])=>(
                    <div key={k}>
                      <p style={{ fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Barlow Condensed',sans-serif" }}>{k}</p>
                      <p style={{ fontSize:"0.9rem", color:"var(--navy)", fontWeight:500, marginTop:"0.15rem" }}>{v}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="Vehículo" icon="🚗">
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem 2rem" }}>
                  {[["Marca y Modelo",`${vehiculo.marca||""} ${vehiculo.modelo}`],["Placas",vehiculo.placas],["Año",vehiculo.anio],["Color",vehiculo.color||"—"]].map(([k,v])=>(
                    <div key={k}>
                      <p style={{ fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Barlow Condensed',sans-serif" }}>{k}</p>
                      <p style={{ fontSize:"0.9rem", color:"var(--navy)", fontWeight:500, marginTop:"0.15rem" }}>{v}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="Refacciones Seleccionadas" icon="🔩">
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr style={{ background:"#F9FAFB" }}>{["Refacción","Lado","Precio"].map(col=><th key={col} style={{ padding:"0.6rem 0.875rem", textAlign:"left", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.1em", textTransform:"uppercase" }}>{col}</th>)}</tr></thead>
                  <tbody>
                    {refacciones.map(r=>{
                      const ls=LADO_COLORS[r.lado]||LADO_COLORS.NA
                      return(
                        <tr key={r.id_refaccion} style={{ borderTop:"1px solid var(--border)" }}>
                          <td style={{ padding:"0.7rem 0.875rem", fontSize:"0.88rem", fontWeight:600, color:"var(--navy)" }}>{r.nombre}</td>
                          <td style={{ padding:"0.7rem 0.875rem" }}><span style={{ background:ls.bg, color:ls.color, border:`1px solid ${ls.border}`, padding:"0.15rem 0.5rem", borderRadius:"4px", fontSize:"0.7rem", fontWeight:700 }}>{LADO_LABELS[r.lado]}</span></td>
                          <td style={{ padding:"0.7rem 0.875rem", fontWeight:700, color:"var(--navy)" }}>${Number(r.precio_unitario).toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop:"2px solid var(--navy)" }}>
                      <td colSpan={2} style={{ padding:"0.875rem", textAlign:"right", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.85rem", color:"var(--navy)", letterSpacing:"0.06em" }}>TOTAL ESTIMADO</td>
                      <td style={{ padding:"0.875rem", fontWeight:800, fontSize:"1.1rem", color:"var(--red)", fontFamily:"'Barlow Condensed',sans-serif" }}>${subtotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
                {observaciones&&<div style={{ marginTop:"1rem", padding:"0.875rem", background:"#F9FAFB", borderRadius:"8px", border:"1px solid var(--border)" }}>
                  <p style={{ fontSize:"0.68rem", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"0.3rem", fontFamily:"'Barlow Condensed',sans-serif" }}>Observaciones</p>
                  <p style={{ fontSize:"0.88rem", color:"var(--navy)", lineHeight:1.6 }}>{observaciones}</p>
                </div>}
              </SectionCard>
            </>
          )}

          {/* Navegación */}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:"1rem" }}>
            <button onClick={() => setStep(s=>s-1)} disabled={step===1} style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.8rem 1.5rem", border:"2px solid var(--border)", borderRadius:"10px", background:"#fff", color:step===1?"#D1D5DB":"var(--navy)", cursor:step===1?"not-allowed":"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.85rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Anterior
            </button>
            {step<4 ? (
              <button onClick={() => canNext()&&setStep(s=>s+1)} disabled={!canNext()} style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.8rem 1.75rem", border:"none", borderRadius:"10px", background:canNext()?"var(--red)":"#E5E7EB", color:canNext()?"#fff":"#9CA3AF", cursor:canNext()?"pointer":"not-allowed", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.85rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", boxShadow:canNext()?"0 4px 14px rgba(200,16,46,0.3)":"none" }}>
                Siguiente
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ) : (
              <button onClick={handleGenerar} disabled={saving} style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.8rem 1.75rem", border:"none", borderRadius:"10px", background:saving?"#9CA3AF":"var(--red)", color:"#fff", cursor:saving?"not-allowed":"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.85rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", boxShadow:saving?"none":"0 4px 14px rgba(200,16,46,0.3)" }}>
                {saving?<><span style={{ width:"16px", height:"16px", border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" }} />GENERANDO...</>:<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>GENERAR ORDEN</>}
              </button>
            )}
          </div>
        </div>

        {/* Panel resumen lateral */}
        <div style={{ position:"sticky", top:"80px" }}>
          <div style={{ background:"#fff", borderRadius:"16px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 4px 20px rgba(15,31,61,0.06)" }}>
            <div style={{ background:"var(--navy)", padding:"1rem 1.25rem" }}>
              <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.85rem", fontWeight:700, color:"#fff", letterSpacing:"0.1em", textTransform:"uppercase" }}>Resumen de Orden</h3>
            </div>
            <div style={{ height:"3px", background:"var(--red)" }} />
            <div style={{ padding:"1.25rem" }}>
              <div style={{ marginBottom:"1rem" }}>
                <p style={{ fontSize:"0.65rem", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"0.3rem", fontFamily:"'Barlow Condensed',sans-serif" }}>Cliente</p>
                {cliente?<p style={{ fontSize:"0.88rem", fontWeight:600, color:"var(--navy)" }}>{cliente.nombre} {cliente.apellido_paterno}</p>:<p style={{ fontSize:"0.82rem", color:"#D1D5DB" }}>Sin seleccionar</p>}
              </div>
              <div style={{ marginBottom:"1rem", paddingTop:"1rem", borderTop:"1px solid var(--border)" }}>
                <p style={{ fontSize:"0.65rem", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"0.3rem", fontFamily:"'Barlow Condensed',sans-serif" }}>Vehículo</p>
                {vehiculo?<><p style={{ fontSize:"0.88rem", fontWeight:600, color:"var(--navy)" }}>{vehiculo.marca} {vehiculo.modelo}</p><p style={{ fontSize:"0.75rem", color:"#9CA3AF", fontFamily:"monospace" }}>{vehiculo.placas}</p></>:<p style={{ fontSize:"0.82rem", color:"#D1D5DB" }}>Sin seleccionar</p>}
              </div>
              <div style={{ paddingTop:"1rem", borderTop:"1px solid var(--border)" }}>
                <p style={{ fontSize:"0.65rem", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"0.5rem", fontFamily:"'Barlow Condensed',sans-serif" }}>Refacciones ({refacciones.length})</p>
                {refacciones.length===0?<p style={{ fontSize:"0.82rem", color:"#D1D5DB" }}>Sin seleccionar</p>:refacciones.map(r=>(
                  <div key={r.id_refaccion} style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.4rem" }}>
                    <span style={{ fontSize:"0.8rem", color:"var(--navy)" }}>{r.nombre}</span>
                    <span style={{ fontSize:"0.8rem", fontWeight:600, color:"var(--navy)" }}>${Number(r.precio_unitario).toFixed(2)}</span>
                  </div>
                ))}
                {refacciones.length>0&&<div style={{ marginTop:"0.75rem", paddingTop:"0.75rem", borderTop:"2px dashed var(--border)", display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.78rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.06em" }}>TOTAL ESTIMADO</span>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1rem", fontWeight:800, color:"var(--red)" }}>${subtotal.toFixed(2)}</span>
                </div>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  )
}

