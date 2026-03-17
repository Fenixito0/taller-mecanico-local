"use client"
import { useState, useEffect } from "react"

const COLORES = ["Blanco","Negro","Gris","Plata","Rojo","Azul","Verde","Amarillo","Café","Naranja","Otro"]
const COLOR_MAP = { Blanco:"#F9FAFB",Negro:"#111827",Gris:"#6B7280",Plata:"#D1D5DB",Rojo:"#DC2626",Azul:"#2563EB",Verde:"#16A34A",Amarillo:"#CA8A04",Café:"#92400E",Naranja:"#EA580C" }

const inputStyle = (hasError) => ({
  width:"100%", padding:"0.8rem 1rem",
  border:`2px solid ${hasError?"var(--red)":"var(--border)"}`,
  borderRadius:"10px", fontSize:"0.9rem", color:"var(--navy)",
  background:"#FAFAFA", fontFamily:"'Barlow',sans-serif",
})

function FormField({ label, required, error, children }) {
  return (
    <div style={{ marginBottom:"1.2rem" }}>
      <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"var(--navy)", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.4rem", fontFamily:"'Barlow Condensed',sans-serif" }}>
        {label} {required && <span style={{ color:"var(--red)" }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize:"0.68rem", color:"var(--red)", marginTop:"0.3rem" }}>{error}</p>}
    </div>
  )
}

function VehiculoModal({ vehiculo, clientes, onClose, onSave }) {
  const [form, setForm]       = useState(vehiculo ? { ...vehiculo } : { marca:"", modelo:"", anio:new Date().getFullYear(), color:"", placas:"", rfc_cliente:"" })
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)
  const [apiError, setApiError] = useState("")
  const isEdit = !!vehiculo
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })) }

  const validate = () => {
    const errs = {}
    if (!form.modelo)      errs.modelo = "El modelo es requerido"
    if (!form.anio)        errs.anio   = "El año es requerido"
    if (!form.placas)      errs.placas = "Las placas son requeridas"
    if (!form.rfc_cliente) errs.rfc_cliente = "Selecciona un cliente"
    return errs
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    setApiError("")
    try {
      const url    = isEdit ? `/api/vehiculos/${vehiculo.id_vehiculo}` : "/api/vehiculos"
      const method = isEdit ? "PUT" : "POST"
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, anio: Number(form.anio) }),
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
      <div style={{ background:"#fff", borderRadius:"18px", width:"100%", maxWidth:"580px", boxShadow:"0 32px 80px rgba(8,15,30,0.25)", animation:"modalIn 0.35s cubic-bezier(0.34,1.4,0.64,1)", overflow:"hidden" }}>
        <div style={{ background:"var(--navy)", padding:"1.4rem 1.75rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.3rem", fontWeight:700, color:"#fff", letterSpacing:"0.05em" }}>{isEdit?"EDITAR VEHÍCULO":"NUEVO VEHÍCULO"}</h3>
            <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"0.78rem" }}>{isEdit?`Placas: ${vehiculo.placas}`:"Complete los datos del vehículo"}</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.1)", border:"none", borderRadius:"8px", padding:"0.5rem", color:"#fff", cursor:"pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ height:"3px", background:"var(--red)" }} />
        <div style={{ padding:"1.75rem" }}>
          {apiError && <div style={{ background:"#FFF0F2", border:"1px solid var(--red)", borderRadius:"10px", padding:"0.75rem 1rem", color:"var(--red)", fontSize:"0.85rem", marginBottom:"1rem" }}>{apiError}</div>}
          <FormField label="Cliente propietario" required error={errors.rfc_cliente}>
            <select value={form.rfc_cliente} onChange={e => set("rfc_cliente", e.target.value)} style={{ ...inputStyle(!!errors.rfc_cliente), cursor:"pointer" }}>
              <option value="">— Seleccione un cliente —</option>
              {clientes.map(c => <option key={c.rfc} value={c.rfc}>{c.nombre} {c.apellido_paterno} ({c.rfc})</option>)}
            </select>
          </FormField>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 1.25rem" }}>
            <FormField label="Marca">
              <input value={form.marca} onChange={e => set("marca", e.target.value)} placeholder="Toyota, Nissan…" style={inputStyle(false)} />
            </FormField>
            <FormField label="Modelo" required error={errors.modelo}>
              <input value={form.modelo} onChange={e => set("modelo", e.target.value)} placeholder="Corolla, Sentra…" style={inputStyle(!!errors.modelo)} />
            </FormField>
            <FormField label="Año" required error={errors.anio}>
              <input type="number" value={form.anio} onChange={e => set("anio", e.target.value)} min={1950} max={new Date().getFullYear()+1} style={inputStyle(!!errors.anio)} />
            </FormField>
            <FormField label="Color">
              <select value={form.color} onChange={e => set("color", e.target.value)} style={{ ...inputStyle(false), cursor:"pointer" }}>
                <option value="">— Seleccione —</option>
                {COLORES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <div style={{ gridColumn:"1/-1" }}>
              <FormField label="Placas" required error={errors.placas}>
                <input value={form.placas} onChange={e => set("placas", e.target.value.toUpperCase())} placeholder="ABC1234" maxLength={10} disabled={isEdit} style={{ ...inputStyle(!!errors.placas), opacity:isEdit?0.6:1 }} />
              </FormField>
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
      <style>{`
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes modalIn { from { transform:scale(0.93) translateY(12px); opacity:0 } to { transform:scale(1) translateY(0); opacity:1 } }
      `}</style>
    </div>
  )
}

export default function VehiculosPage() {
  const [vehiculos, setVehiculos] = useState([])
  const [clientes, setClientes]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState("")
  const [modal, setModal]         = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [deleting, setDeleting]   = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [vRes, cRes] = await Promise.all([fetch("/api/vehiculos"), fetch("/api/clientes")])
      setVehiculos(await vRes.json())
      setClientes(await cRes.json())
    } catch { /* error silencioso */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = vehiculos.filter(v =>
    `${v.marca} ${v.modelo} ${v.placas} ${v.cliente}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`/api/vehiculos/${delTarget.id_vehiculo}`, { method: "DELETE" })
    setDelTarget(null)
    setDeleting(false)
    fetchData()
  }

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2rem" }}>
        <div>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"2rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.04em" }}>VEHÍCULOS</h1>
          <p style={{ color:"#9CA3AF", fontSize:"0.875rem", marginTop:"0.2rem" }}>{vehiculos.length} vehículo{vehiculos.length!==1?"s":""} registrado{vehiculos.length!==1?"s":""}</p>
        </div>
        <button onClick={() => setModal("new")} style={{ display:"flex", alignItems:"center", gap:"0.5rem", background:"var(--red)", color:"#fff", border:"none", borderRadius:"10px", padding:"0.7rem 1.25rem", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.85rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", boxShadow:"0 4px 14px rgba(200,16,46,0.3)" }}
          onMouseEnter={e => e.currentTarget.style.background="var(--red-dark)"}
          onMouseLeave={e => e.currentTarget.style.background="var(--red)"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo Vehículo
        </button>
      </div>

      <div style={{ position:"relative", marginBottom:"1.5rem" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ position:"absolute", left:"1rem", top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por marca, modelo, placas..." style={{ width:"100%", maxWidth:"360px", padding:"0.75rem 1rem 0.75rem 2.75rem", border:"2px solid var(--border)", borderRadius:"10px", fontSize:"0.875rem", color:"var(--navy)", background:"#fff", fontFamily:"'Barlow',sans-serif" }} />
      </div>

      <div style={{ background:"#fff", borderRadius:"16px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 4px 24px rgba(15,31,61,0.06)" }}>
        {loading ? (
          <div style={{ padding:"3rem", textAlign:"center", color:"#9CA3AF" }}>
            <span style={{ display:"inline-block", width:"28px", height:"28px", border:"3px solid var(--border)", borderTopColor:"var(--red)", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
            <p style={{ marginTop:"1rem" }}>Cargando vehículos...</p>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"var(--navy)" }}>
                {["Placas","Vehículo","Año","Color","Cliente","Acciones"].map(col => (
                  <th key={col} style={{ padding:"0.9rem 1.25rem", textAlign:"left", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.14em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding:"3rem", textAlign:"center", color:"#9CA3AF" }}>No se encontraron vehículos</td></tr>
              ) : filtered.map((v, i) => (
                <tr key={v.id_vehiculo} style={{ background:i%2===0?"#fff":"#FAFBFC", borderBottom:"1px solid var(--border)" }}
                  onMouseEnter={e => e.currentTarget.style.background="#F0F4FF"}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?"#fff":"#FAFBFC"}>
                  <td style={{ padding:"0.95rem 1.25rem" }}>
                    <span style={{ fontFamily:"monospace", fontSize:"0.85rem", fontWeight:700, background:"#E8ECF4", color:"var(--navy)", padding:"0.25rem 0.6rem", borderRadius:"6px", letterSpacing:"0.08em" }}>{v.placas}</span>
                  </td>
                  <td style={{ padding:"0.95rem 1.25rem", fontSize:"0.9rem", color:"var(--navy)", fontWeight:500 }}>{v.marca} {v.modelo}</td>
                  <td style={{ padding:"0.95rem 1.25rem", fontSize:"0.875rem", color:"#4B5563" }}>{v.anio}</td>
                  <td style={{ padding:"0.95rem 1.25rem" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                      <div style={{ width:"14px", height:"14px", borderRadius:"50%", background:COLOR_MAP[v.color]||"#E5E7EB", border:"1px solid rgba(0,0,0,0.1)", flexShrink:0 }} />
                      <span style={{ fontSize:"0.875rem", color:"#4B5563" }}>{v.color||"—"}</span>
                    </div>
                  </td>
                  <td style={{ padding:"0.95rem 1.25rem", fontSize:"0.875rem", color:"#4B5563" }}>{v.cliente||"—"}</td>
                  <td style={{ padding:"0.95rem 1.25rem" }}>
                    <div style={{ display:"flex", gap:"0.5rem" }}>
                      <button onClick={() => setModal(v)} style={{ display:"flex", alignItems:"center", gap:"0.35rem", padding:"0.4rem 0.75rem", background:"#E8ECF4", border:"none", borderRadius:"7px", color:"var(--navy)", fontSize:"0.78rem", fontWeight:600, cursor:"pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background="#C5CDE0"}
                        onMouseLeave={e => e.currentTarget.style.background="#E8ECF4"}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Editar
                      </button>
                      <button onClick={() => setDelTarget(v)} style={{ display:"flex", alignItems:"center", gap:"0.35rem", padding:"0.4rem 0.75rem", background:"#FFF0F2", border:"none", borderRadius:"7px", color:"var(--red)", fontSize:"0.78rem", fontWeight:600, cursor:"pointer" }}
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
          <span style={{ fontSize:"0.8rem", color:"#9CA3AF" }}>Mostrando {filtered.length} de {vehiculos.length} vehículos</span>
        </div>
      </div>

      {modal !== null && (
        <VehiculoModal vehiculo={modal==="new"?null:modal} clientes={clientes} onClose={() => setModal(null)} onSave={() => { setModal(null); fetchData() }} />
      )}

      {delTarget && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(8,15,30,0.6)", display:"flex", alignItems:"center", justifyContent:"center", animation:"fadeIn 0.2s ease-out" }}>
          <div style={{ background:"#fff", borderRadius:"16px", padding:"2rem", maxWidth:"380px", width:"90%", textAlign:"center", animation:"modalIn 0.3s cubic-bezier(0.34,1.4,0.64,1)" }}>
            <div style={{ width:"56px", height:"56px", background:"#FFF0F2", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1rem" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </div>
            <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.2rem", color:"var(--navy)", marginBottom:"0.5rem" }}>¿Eliminar vehículo?</h3>
            <div style={{ background:"#F9FAFB", borderRadius:"10px", padding:"0.875rem 1rem", marginBottom:"1rem", border:"1px solid var(--border)", textAlign:"left" }}>
              <p style={{ fontWeight:700, fontSize:"0.9rem", color:"var(--navy)" }}>{delTarget.marca} {delTarget.modelo} {delTarget.anio}</p>
              <p style={{ fontSize:"0.75rem", color:"#9CA3AF", fontFamily:"monospace" }}>{delTarget.placas}</p>
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
      <style>{`
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes modalIn { from { transform:scale(0.93) translateY(12px); opacity:0 } to { transform:scale(1) translateY(0); opacity:1 } }
        @keyframes spin    { to { transform:rotate(360deg) } }
      `}</style>
    </>
  )
}
