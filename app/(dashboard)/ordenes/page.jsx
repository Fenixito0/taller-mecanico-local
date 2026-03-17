"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

// ============================================================
// ARCHIVO: app/(dashboard)/ordenes/page.jsx
// ============================================================

const ESTADO_CONFIG = {
  pendiente:  { label:"Pendiente",  bg:"#FFF7ED", color:"#C2410C", border:"#FED7AA", dot:"#F97316" },
  en_proceso: { label:"En proceso", bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE", dot:"#3B82F6" },
  completado: { label:"Completado", bg:"#F0FDF4", color:"#15803D", border:"#BBF7D0", dot:"#22C55E" },
  cancelado:  { label:"Cancelado",  bg:"#FFF1F2", color:"#BE123C", border:"#FECDD3", dot:"#F43F5E" },
}
const LADO_COLORS = {
  izquierdo:{ bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE" },
  derecho:  { bg:"#F0FDF4", color:"#15803D", border:"#BBF7D0" },
  central:  { bg:"#FFF7ED", color:"#C2410C", border:"#FED7AA" },
  NA:       { bg:"#F9FAFB", color:"#6B7280", border:"#E5E7EB" },
}
const LADO_LABELS = { izquierdo:"Izq", derecho:"Der", central:"Cen", NA:"N/A" }

function EstadoBadge({ estado }) {
  const s = ESTADO_CONFIG[estado] || ESTADO_CONFIG.pendiente
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"0.4rem", background:s.bg, color:s.color, border:`1px solid ${s.border}`, padding:"0.25rem 0.7rem", borderRadius:"20px", fontSize:"0.75rem", fontWeight:600 }}>
      <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:s.dot }} />
      {s.label}
    </span>
  )
}

export default function OrdenesPage() {
  const [ordenes, setOrdenes]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [expandidas, setExpandidas]   = useState(new Set())

  const fetchOrdenes = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ordenes")
      setOrdenes(await res.json())
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchOrdenes() }, [])

  const toggleExpand = (id) => {
    setExpandidas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = ordenes.filter(o => {
    const matchSearch = `${o.cliente} ${o.placas} ${o.vehiculo}`.toLowerCase().includes(search.toLowerCase())
    const matchEstado = filtroEstado === "todos" || o.estado === filtroEstado
    return matchSearch && matchEstado
  })

  const counts = {
    pendiente:  ordenes.filter(o => o.estado === "pendiente").length,
    en_proceso: ordenes.filter(o => o.estado === "en_proceso").length,
    completado: ordenes.filter(o => o.estado === "completado").length,
  }

  const cobrable = (estado) => estado === "pendiente" || estado === "en_proceso"

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2rem" }}>
        <div>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"2rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.04em" }}>ÓRDENES DE SERVICIO</h1>
          <p style={{ color:"#9CA3AF", fontSize:"0.875rem", marginTop:"0.2rem" }}>{ordenes.length} orden{ordenes.length!==1?"es":""} registrada{ordenes.length!==1?"s":""}</p>
        </div>
        <Link href="/ordenes/nueva" style={{ textDecoration:"none" }}>
          <button style={{ display:"flex", alignItems:"center", gap:"0.5rem", background:"var(--red)", color:"#fff", border:"none", borderRadius:"10px", padding:"0.7rem 1.25rem", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.85rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", boxShadow:"0 4px 14px rgba(200,16,46,0.3)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva Orden
          </button>
        </Link>
      </div>

      {/* Tarjetas resumen */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem", marginBottom:"1.75rem" }}>
        {[{ label:"Pendientes",count:counts.pendiente,icon:"⏳",bg:"#FFF7ED",color:"#C2410C" },{ label:"En proceso",count:counts.en_proceso,icon:"🔧",bg:"#EFF6FF",color:"#1D4ED8" },{ label:"Completadas",count:counts.completado,icon:"✅",bg:"#F0FDF4",color:"#15803D" }].map(card => (
          <div key={card.label} style={{ background:"#fff", borderRadius:"14px", padding:"1.25rem 1.5rem", border:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"1rem", boxShadow:"0 2px 8px rgba(15,31,61,0.05)" }}>
            <div style={{ width:"46px", height:"46px", background:card.bg, borderRadius:"12px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", flexShrink:0 }}>{card.icon}</div>
            <div>
              <p style={{ fontSize:"1.6rem", fontWeight:800, color:card.color, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{card.count}</p>
              <p style={{ fontSize:"0.78rem", color:"#9CA3AF", marginTop:"0.15rem" }}>{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:"1rem", marginBottom:"1.5rem", flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ position:"absolute", left:"1rem", top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente, placas..." style={{ width:"280px", padding:"0.75rem 1rem 0.75rem 2.75rem", border:"2px solid var(--border)", borderRadius:"10px", fontSize:"0.875rem", color:"var(--navy)", background:"#fff", fontFamily:"'Barlow',sans-serif" }} />
        </div>
        <div style={{ display:"flex", gap:"0.4rem" }}>
          {[["todos","Todos"],["pendiente","Pendiente"],["en_proceso","En proceso"],["completado","Completado"],["cancelado","Cancelado"]].map(([val,lbl]) => (
            <button key={val} onClick={() => setFiltroEstado(val)} style={{ padding:"0.5rem 0.875rem", borderRadius:"8px", border:`1.5px solid ${filtroEstado===val?"var(--navy)":"var(--border)"}`, background:filtroEstado===val?"var(--navy)":"#fff", color:filtroEstado===val?"#fff":"#6B7280", fontSize:"0.78rem", fontWeight:600, cursor:"pointer", transition:"all 0.15s", fontFamily:"'Barlow Condensed',sans-serif" }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div style={{ background:"#fff", borderRadius:"16px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 4px 24px rgba(15,31,61,0.06)" }}>
        {loading ? (
          <div style={{ padding:"3rem", textAlign:"center", color:"#9CA3AF" }}>
            <span style={{ display:"inline-block", width:"28px", height:"28px", border:"3px solid var(--border)", borderTopColor:"var(--red)", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
            <p style={{ marginTop:"1rem" }}>Cargando órdenes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:"4rem", textAlign:"center" }}>
            <p style={{ color:"#9CA3AF", fontSize:"0.95rem" }}>No hay órdenes que mostrar</p>
            <p style={{ color:"#D1D5DB", fontSize:"0.82rem", marginTop:"0.3rem" }}>
              {filtroEstado !== "todos" ? `No hay órdenes con estado "${ESTADO_CONFIG[filtroEstado]?.label}"` : "Crea una nueva orden"}
            </p>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"var(--navy)" }}>
                <th style={{ width:"40px", padding:"0.9rem 0.5rem 0.9rem 1.25rem" }} />
                {["# Orden","Cliente","Vehículo","Total estimado","Fecha","Estado","Acciones"].map(col => (
                  <th key={col} style={{ padding:"0.9rem 1.25rem", textAlign:"left", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.14em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const isExpanded = expandidas.has(o.id_orden)
                const total = o.refacciones.reduce((s, r) => s + r.precio_unitario * r.cantidad, 0)
                return (
                  <>
                    <tr key={o.id_orden} style={{ background:isExpanded?"#F8FAFF":i%2===0?"#fff":"#FAFBFC", borderBottom:isExpanded?"none":"1px solid var(--border)" }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background="#F0F4FF" }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background=i%2===0?"#fff":"#FAFBFC" }}>
                      <td style={{ padding:"0.95rem 0.5rem 0.95rem 1.25rem" }}>
                        <button onClick={() => toggleExpand(o.id_orden)} style={{ width:"28px", height:"28px", border:"1.5px solid var(--border)", borderRadius:"7px", background:isExpanded?"var(--navy)":"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s", color:isExpanded?"#fff":"#6B7280" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition:"transform 0.2s", transform:isExpanded?"rotate(180deg)":"none" }}><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                      </td>
                      <td style={{ padding:"0.95rem 1.25rem" }}>
                        <span style={{ fontFamily:"monospace", fontSize:"0.85rem", fontWeight:700, background:"#E8ECF4", color:"var(--navy)", padding:"0.25rem 0.6rem", borderRadius:"6px" }}>#{String(o.id_orden).padStart(4,"0")}</span>
                      </td>
                      <td style={{ padding:"0.95rem 1.25rem" }}>
                        <p style={{ fontSize:"0.88rem", fontWeight:600, color:"var(--navy)" }}>{o.cliente}</p>
                        <p style={{ fontSize:"0.75rem", color:"#9CA3AF" }}>{o.rfc}</p>
                      </td>
                      <td style={{ padding:"0.95rem 1.25rem" }}>
                        <p style={{ fontSize:"0.88rem", color:"var(--navy)" }}>{o.vehiculo}</p>
                        <p style={{ fontSize:"0.75rem", color:"#9CA3AF", fontFamily:"monospace" }}>{o.placas}</p>
                      </td>
                      <td style={{ padding:"0.95rem 1.25rem" }}>
                        <p style={{ fontWeight:700, fontSize:"0.9rem", color:"var(--navy)" }}>${total.toFixed(2)}</p>
                        <p style={{ fontSize:"0.72rem", color:"#9CA3AF" }}>{o.refacciones.length} pieza{o.refacciones.length!==1?"s":""}</p>
                      </td>
                      <td style={{ padding:"0.95rem 1.25rem", fontSize:"0.82rem", color:"#6B7280" }}>
                        {new Date(o.fecha_creacion).toLocaleDateString("es-MX",{ day:"2-digit", month:"short", year:"numeric" })}
                      </td>
                      <td style={{ padding:"0.95rem 1.25rem" }}><EstadoBadge estado={o.estado} /></td>
                      <td style={{ padding:"0.95rem 1.25rem" }}>
                        {cobrable(o.estado) ? (
                          <Link href={`/ventas/${o.id_orden}`} style={{ textDecoration:"none" }}>
                            <button style={{ display:"flex", alignItems:"center", gap:"0.35rem", padding:"0.4rem 0.75rem", background:"#FFF0F2", border:"none", borderRadius:"7px", color:"var(--red)", fontSize:"0.78rem", fontWeight:600, cursor:"pointer" }}
                              onMouseEnter={e => e.currentTarget.style.background="#FFD6DB"}
                              onMouseLeave={e => e.currentTarget.style.background="#FFF0F2"}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                              Cobrar
                            </button>
                          </Link>
                        ) : (
                          <span style={{ fontSize:"0.78rem", color:"#D1D5DB", fontStyle:"italic" }}>{o.estado==="completado"?"Pagada":"Cancelada"}</span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${o.id_orden}-piezas`}>
                        <td colSpan={8} style={{ padding:0, borderBottom:"1px solid var(--border)" }}>
                          <div style={{ background:"#F8FAFF", padding:"0 1.25rem 1.25rem 1.25rem", borderTop:"1px dashed #C7D2FE" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.875rem 0 0.6rem" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.72rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.12em", textTransform:"uppercase" }}>Piezas asignadas</span>
                            </div>
                            <div style={{ background:"#fff", borderRadius:"10px", border:"1px solid var(--border)", overflow:"hidden" }}>
                              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                                <thead>
                                  <tr style={{ background:"#F1F5F9" }}>
                                    {["Refacción","Lado","Cantidad","Precio unitario","Subtotal"].map(col => (
                                      <th key={col} style={{ padding:"0.6rem 1rem", textAlign:"left", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.65rem", fontWeight:700, color:"#64748B", letterSpacing:"0.1em", textTransform:"uppercase" }}>{col}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {o.refacciones.map((r, ri) => {
                                    const ls = LADO_COLORS[r.lado] || LADO_COLORS.NA
                                    return (
                                      <tr key={r.id_refaccion} style={{ borderTop:ri===0?"none":"1px solid #F1F5F9" }}>
                                        <td style={{ padding:"0.6rem 1rem", fontSize:"0.875rem", fontWeight:600, color:"var(--navy)" }}>{r.nombre}</td>
                                        <td style={{ padding:"0.6rem 1rem" }}>
                                          <span style={{ background:ls.bg, color:ls.color, border:`1px solid ${ls.border}`, padding:"0.15rem 0.5rem", borderRadius:"4px", fontSize:"0.7rem", fontWeight:700 }}>{LADO_LABELS[r.lado]}</span>
                                        </td>
                                        <td style={{ padding:"0.6rem 1rem", textAlign:"center", fontWeight:700, color:"var(--navy)" }}>{r.cantidad}</td>
                                        <td style={{ padding:"0.6rem 1rem", color:"#4B5563" }}>${r.precio_unitario.toFixed(2)}</td>
                                        <td style={{ padding:"0.6rem 1rem", fontWeight:700, color:"var(--navy)" }}>${(r.precio_unitario * r.cantidad).toFixed(2)}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr style={{ borderTop:"2px solid var(--border)" }}>
                                    <td colSpan={4} style={{ padding:"0.7rem 1rem", textAlign:"right", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.75rem", color:"var(--navy)", textTransform:"uppercase" }}>TOTAL REFACCIONES</td>
                                    <td style={{ padding:"0.7rem 1rem", fontWeight:800, color:"var(--red)", fontFamily:"'Barlow Condensed',sans-serif" }}>${total.toFixed(2)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && filtered.length > 0 && (
          <div style={{ padding:"0.875rem 1.25rem", borderTop:"1px solid var(--border)", background:"#FAFAFA" }}>
            <span style={{ fontSize:"0.8rem", color:"#9CA3AF" }}>Mostrando {filtered.length} de {ordenes.length} órdenes</span>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
