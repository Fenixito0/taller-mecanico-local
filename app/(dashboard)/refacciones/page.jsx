// ============================================================
// INSTRUCCIONES:
// Este archivo contiene las páginas restantes conectadas a la API.
// Cada sección indica en qué archivo va el código.
// ============================================================

// ── app/(dashboard)/refacciones/page.jsx ────────────────────
"use client"
import { useState, useEffect } from "react"

const LADO_COLORS = {
  izquierdo:{ bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE" },
  derecho:  { bg:"#F0FDF4", color:"#15803D", border:"#BBF7D0" },
  central:  { bg:"#FFF7ED", color:"#C2410C", border:"#FED7AA" },
  NA:       { bg:"#F9FAFB", color:"#6B7280", border:"#E5E7EB" },
}
const LADO_LABELS = { izquierdo:"Izquierdo", derecho:"Derecho", central:"Central", NA:"N/A" }

const inputStyle = (hasError) => ({
  width:"100%", padding:"0.8rem 1rem",
  border:`2px solid ${hasError?"var(--red)":"var(--border)"}`,
  borderRadius:"10px", fontSize:"0.9rem", color:"var(--navy)",
  background:"#FAFAFA", fontFamily:"'Barlow',sans-serif",
})

function LadoBadge({ lado }) {
  const s = LADO_COLORS[lado] || LADO_COLORS.NA
  return <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}`, padding:"0.2rem 0.65rem", borderRadius:"6px", fontSize:"0.75rem", fontWeight:600 }}>{LADO_LABELS[lado]||lado}</span>
}

function RefaccionModal({ refaccion, onClose, onSave }) {
  const [form, setForm]       = useState(refaccion ? { ...refaccion, precio_unitario: String(refaccion.precio_unitario) } : { nombre:"", descripcion:"", lado:"NA", precio_unitario:"" })
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)
  const [apiError, setApiError] = useState("")
  const isEdit = !!refaccion
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })) }

  const handleSave = async () => {
    const errs = {}
    if (!form.nombre)         errs.nombre = "El nombre es requerido"
    if (!form.precio_unitario || isNaN(form.precio_unitario)) errs.precio_unitario = "Precio inválido"
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    setApiError("")
    try {
      const url    = isEdit ? `/api/refacciones/${refaccion.id_refaccion}` : "/api/refacciones"
      const method = isEdit ? "PUT" : "POST"
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, precio_unitario: parseFloat(form.precio_unitario) }),
      })
      const data = await res.json()
      if (!res.ok) { setApiError(data.error || "Error al guardar"); setSaving(false); return }
      onSave()
    } catch {
      setApiError("Error de conexión")
      setSaving(false)
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(8,15,30,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem", animation:"fadeIn 0.2s ease-out" }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={{ background:"#fff", borderRadius:"18px", width:"100%", maxWidth:"560px", boxShadow:"0 32px 80px rgba(8,15,30,0.25)", animation:"modalIn 0.35s cubic-bezier(0.34,1.4,0.64,1)", overflow:"hidden" }}>
        <div style={{ background:"var(--navy)", padding:"1.4rem 1.75rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.3rem", fontWeight:700, color:"#fff", letterSpacing:"0.05em" }}>{isEdit?"EDITAR REFACCIÓN":"NUEVA REFACCIÓN"}</h3>
            <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"0.78rem" }}>{isEdit?refaccion.nombre:"Agregar al catálogo"}</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.1)", border:"none", borderRadius:"8px", padding:"0.5rem", color:"#fff", cursor:"pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ height:"3px", background:"var(--red)" }} />
        <div style={{ padding:"1.75rem" }}>
          {apiError && <div style={{ background:"#FFF0F2", border:"1px solid var(--red)", borderRadius:"10px", padding:"0.75rem", color:"var(--red)", fontSize:"0.85rem", marginBottom:"1rem" }}>{apiError}</div>}
          <div style={{ marginBottom:"1.2rem" }}>
            <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"var(--navy)", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.4rem", fontFamily:"'Barlow Condensed',sans-serif" }}>Nombre <span style={{ color:"var(--red)" }}>*</span></label>
            <input value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej. Pastilla de freno" style={inputStyle(!!errors.nombre)} />
            {errors.nombre && <p style={{ fontSize:"0.68rem", color:"var(--red)", marginTop:"0.3rem" }}>{errors.nombre}</p>}
          </div>
          <div style={{ marginBottom:"1.2rem" }}>
            <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"var(--navy)", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.4rem", fontFamily:"'Barlow Condensed',sans-serif" }}>Descripción</label>
            <textarea value={form.descripcion} onChange={e => set("descripcion", e.target.value)} placeholder="Descripción detallada..." rows={3} style={{ ...inputStyle(false), resize:"vertical", lineHeight:1.5 }} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 1.25rem" }}>
            <div style={{ marginBottom:"1.2rem" }}>
              <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"var(--navy)", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.4rem", fontFamily:"'Barlow Condensed',sans-serif" }}>Lado</label>
              <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
                {Object.entries(LADO_LABELS).map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => set("lado", val)} style={{ padding:"0.5rem 0.875rem", borderRadius:"8px", cursor:"pointer", fontSize:"0.82rem", fontWeight:600, border:`2px solid ${form.lado===val?"var(--red)":"var(--border)"}`, background:form.lado===val?"#FFF0F2":"#fff", color:form.lado===val?"var(--red)":"#6B7280", transition:"all 0.15s" }}>{lbl}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:"1.2rem" }}>
              <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"var(--navy)", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.4rem", fontFamily:"'Barlow Condensed',sans-serif" }}>Precio (MXN) <span style={{ color:"var(--red)" }}>*</span></label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:"1rem", top:"50%", transform:"translateY(-50%)", color:"#9CA3AF" }}>$</span>
                <input type="number" value={form.precio_unitario} onChange={e => set("precio_unitario", e.target.value)} placeholder="0.00" min="0" step="0.01" style={{ ...inputStyle(!!errors.precio_unitario), paddingLeft:"1.75rem" }} />
              </div>
              {errors.precio_unitario && <p style={{ fontSize:"0.68rem", color:"var(--red)", marginTop:"0.3rem" }}>{errors.precio_unitario}</p>}
            </div>
          </div>
        </div>
        <div style={{ padding:"1.25rem 1.75rem", borderTop:"1px solid var(--border)", background:"#FAFAFA", display:"flex", justifyContent:"flex-end", gap:"0.75rem" }}>
          <button onClick={onClose} style={{ padding:"0.75rem 1.5rem", border:"2px solid var(--border)", borderRadius:"10px", background:"#fff", color:"var(--navy)", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.82rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>CANCELAR</button>
          <button onClick={handleSave} disabled={saving} style={{ padding:"0.75rem 1.75rem", background:saving?"#9CA3AF":"var(--red)", border:"none", borderRadius:"10px", color:"#fff", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.82rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", cursor:saving?"not-allowed":"pointer" }}>
            {saving?"GUARDANDO...":isEdit?"ACTUALIZAR":"GUARDAR"}
          </button>
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes modalIn{from{transform:scale(0.93) translateY(12px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}`}</style>
    </div>
  )
}

export default function RefaccionesPage() {
  const [refacciones, setRefacciones] = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState("")
  const [filtroLado, setFiltroLado]   = useState("todos")
  const [modal, setModal]             = useState(null)
  const [delTarget, setDelTarget]     = useState(null)
  const [deleting, setDeleting]       = useState(false)

  const fetchRefacciones = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/refacciones")
      setRefacciones(await res.json())
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchRefacciones() }, [])

  const filtered = refacciones.filter(r => {
    const matchSearch = `${r.nombre} ${r.descripcion||""}`.toLowerCase().includes(search.toLowerCase())
    const matchLado   = filtroLado === "todos" || r.lado === filtroLado
    return matchSearch && matchLado
  })

  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`/api/refacciones/${delTarget.id_refaccion}`, { method:"DELETE" })
    setDelTarget(null)
    setDeleting(false)
    fetchRefacciones()
  }

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2rem" }}>
        <div>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"2rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.04em" }}>CATÁLOGO DE REFACCIONES</h1>
          <p style={{ color:"#9CA3AF", fontSize:"0.875rem", marginTop:"0.2rem" }}>{refacciones.length} refacción{refacciones.length!==1?"es":""} en catálogo</p>
        </div>
        <button onClick={() => setModal("new")} style={{ display:"flex", alignItems:"center", gap:"0.5rem", background:"var(--red)", color:"#fff", border:"none", borderRadius:"10px", padding:"0.7rem 1.25rem", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.85rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", boxShadow:"0 4px 14px rgba(200,16,46,0.3)" }}
          onMouseEnter={e => e.currentTarget.style.background="var(--red-dark)"}
          onMouseLeave={e => e.currentTarget.style.background="var(--red)"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva Refacción
        </button>
      </div>

      <div style={{ display:"flex", gap:"1rem", marginBottom:"1.5rem", flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ position:"absolute", left:"1rem", top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar refacción..." style={{ width:"280px", padding:"0.75rem 1rem 0.75rem 2.75rem", border:"2px solid var(--border)", borderRadius:"10px", fontSize:"0.875rem", color:"var(--navy)", background:"#fff", fontFamily:"'Barlow',sans-serif" }} />
        </div>
        <div style={{ display:"flex", gap:"0.4rem" }}>
          {[["todos","Todos"],["izquierdo","Izquierdo"],["derecho","Derecho"],["central","Central"],["NA","N/A"]].map(([val,lbl]) => (
            <button key={val} onClick={() => setFiltroLado(val)} style={{ padding:"0.5rem 0.875rem", borderRadius:"8px", border:`1.5px solid ${filtroLado===val?"var(--navy)":"var(--border)"}`, background:filtroLado===val?"var(--navy)":"#fff", color:filtroLado===val?"#fff":"#6B7280", fontSize:"0.78rem", fontWeight:600, cursor:"pointer", transition:"all 0.15s", fontFamily:"'Barlow Condensed',sans-serif" }}>{lbl}</button>
          ))}
        </div>
      </div>

      <div style={{ background:"#fff", borderRadius:"16px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 4px 24px rgba(15,31,61,0.06)" }}>
        {loading ? (
          <div style={{ padding:"3rem", textAlign:"center", color:"#9CA3AF" }}>
            <span style={{ display:"inline-block", width:"28px", height:"28px", border:"3px solid var(--border)", borderTopColor:"var(--red)", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
            <p style={{ marginTop:"1rem" }}>Cargando catálogo...</p>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"var(--navy)" }}>
                {["Nombre","Descripción","Lado","Precio","Acciones"].map(col => (
                  <th key={col} style={{ padding:"0.9rem 1.25rem", textAlign:"left", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.14em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding:"3rem", textAlign:"center", color:"#9CA3AF" }}>No se encontraron refacciones</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.id_refaccion} style={{ background:i%2===0?"#fff":"#FAFBFC", borderBottom:"1px solid var(--border)" }}
                  onMouseEnter={e => e.currentTarget.style.background="#F0F4FF"}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?"#fff":"#FAFBFC"}>
                  <td style={{ padding:"0.95rem 1.25rem", fontSize:"0.9rem", fontWeight:600, color:"var(--navy)" }}>{r.nombre}</td>
                  <td style={{ padding:"0.95rem 1.25rem", fontSize:"0.85rem", color:"#6B7280", maxWidth:"260px" }}>
                    <span style={{ display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{r.descripcion||"—"}</span>
                  </td>
                  <td style={{ padding:"0.95rem 1.25rem" }}><LadoBadge lado={r.lado} /></td>
                  <td style={{ padding:"0.95rem 1.25rem", fontWeight:700, color:"var(--navy)", fontSize:"0.9rem" }}>
                    ${Number(r.precio_unitario).toFixed(2)} <span style={{ color:"#9CA3AF", fontSize:"0.75rem", fontWeight:400 }}>MXN</span>
                  </td>
                  <td style={{ padding:"0.95rem 1.25rem" }}>
                    <div style={{ display:"flex", gap:"0.5rem" }}>
                      <button onClick={() => setModal(r)} style={{ display:"flex", alignItems:"center", gap:"0.35rem", padding:"0.4rem 0.75rem", background:"#E8ECF4", border:"none", borderRadius:"7px", color:"var(--navy)", fontSize:"0.78rem", fontWeight:600, cursor:"pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background="#C5CDE0"}
                        onMouseLeave={e => e.currentTarget.style.background="#E8ECF4"}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Editar
                      </button>
                      <button onClick={() => setDelTarget(r)} style={{ display:"flex", alignItems:"center", gap:"0.35rem", padding:"0.4rem 0.75rem", background:"#FFF0F2", border:"none", borderRadius:"7px", color:"var(--red)", fontSize:"0.78rem", fontWeight:600, cursor:"pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background="#FFD6DB"}
                        onMouseLeave={e => e.currentTarget.style.background="#FFF0F2"}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding:"0.875rem 1.25rem", borderTop:"1px solid var(--border)", background:"#FAFAFA" }}>
          <span style={{ fontSize:"0.8rem", color:"#9CA3AF" }}>Mostrando {filtered.length} de {refacciones.length} refacciones</span>
        </div>
      </div>

      {modal !== null && (
        <RefaccionModal refaccion={modal==="new"?null:modal} onClose={() => setModal(null)} onSave={() => { setModal(null); fetchRefacciones() }} />
      )}

      {delTarget && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(8,15,30,0.6)", display:"flex", alignItems:"center", justifyContent:"center", animation:"fadeIn 0.2s ease-out" }}>
          <div style={{ background:"#fff", borderRadius:"16px", padding:"2rem", maxWidth:"380px", width:"90%", textAlign:"center", animation:"modalIn 0.3s cubic-bezier(0.34,1.4,0.64,1)" }}>
            <div style={{ width:"56px", height:"56px", background:"#FFF0F2", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1rem" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </div>
            <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.2rem", color:"var(--navy)", marginBottom:"0.75rem" }}>¿Eliminar refacción?</h3>
            <div style={{ background:"#F9FAFB", borderRadius:"10px", padding:"0.875rem", marginBottom:"1rem", border:"1px solid var(--border)", textAlign:"left" }}>
              <p style={{ fontWeight:700, fontSize:"0.9rem", color:"var(--navy)" }}>{delTarget.nombre}</p>
              <LadoBadge lado={delTarget.lado} />
            </div>
            <p style={{ color:"#9CA3AF", fontSize:"0.82rem", marginBottom:"1.25rem" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display:"flex", gap:"0.75rem", justifyContent:"center" }}>
              <button onClick={() => setDelTarget(null)} style={{ padding:"0.7rem 1.5rem", border:"2px solid var(--border)", borderRadius:"10px", background:"#fff", color:"var(--navy)", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.82rem", fontWeight:700, cursor:"pointer" }}>CANCELAR</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding:"0.7rem 1.5rem", border:"none", borderRadius:"10px", background:deleting?"#9CA3AF":"var(--red)", color:"#fff", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.82rem", fontWeight:700, cursor:deleting?"not-allowed":"pointer" }}>
                {deleting?"ELIMINANDO...":"ELIMINAR"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes modalIn{from{transform:scale(0.93) translateY(12px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
