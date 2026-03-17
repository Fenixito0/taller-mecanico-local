"use client"
import { useState, useEffect } from "react"

const FORM_EMPTY = { rfc:"", nombre:"", apellido_paterno:"", apellido_materno:"", telefono:"", correo:"" }

const validators = {
  rfc:              v => /^[A-Z0-9]{0,13}$/.test(v),
  nombre:           v => /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]*$/.test(v),
  apellido_paterno: v => /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]*$/.test(v),
  apellido_materno: v => /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]*$/.test(v),
  telefono:         v => /^\d{0,10}$/.test(v),
  correo:           () => true,
}

const validateRequired = (form) => {
  const errors = {}
  if (!form.rfc || form.rfc.length < 12)            errors.rfc = "RFC debe tener entre 12 y 13 caracteres"
  if (!form.nombre)                                  errors.nombre = "El nombre es requerido"
  if (!form.apellido_paterno)                        errors.apellido_paterno = "El apellido paterno es requerido"
  if (form.telefono && form.telefono.length !== 10)  errors.telefono = "El teléfono debe tener 10 dígitos"
  if (form.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) errors.correo = "Correo inválido"
  return errors
}

const inputStyle = (hasError) => ({
  width:"100%", padding:"0.8rem 1rem",
  border:`2px solid ${hasError?"var(--red)":"var(--border)"}`,
  borderRadius:"10px", fontSize:"0.9rem", color:"var(--navy)",
  background:"#FAFAFA", fontFamily:"'Barlow',sans-serif",
  transition:"border-color 0.2s",
})

function FormField({ label, required, error, hint, children }) {
  return (
    <div style={{ marginBottom:"1.2rem" }}>
      <label style={{ display:"block", fontSize:"0.68rem", fontWeight:700, color:"var(--navy)", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.4rem", fontFamily:"'Barlow Condensed',sans-serif" }}>
        {label} {required && <span style={{ color:"var(--red)" }}>*</span>}
      </label>
      {children}
      {hint && !error && <p style={{ fontSize:"0.68rem", color:"#9CA3AF", marginTop:"0.3rem" }}>{hint}</p>}
      {error && <p style={{ fontSize:"0.68rem", color:"var(--red)", marginTop:"0.3rem", display:"flex", alignItems:"center", gap:"0.3rem" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {error}
      </p>}
    </div>
  )
}

function ClienteModal({ cliente, onClose, onSave, existingRfcs }) {
  const [form, setForm]     = useState(cliente || FORM_EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState("")
  const isEdit = !!cliente

  const handleChange = (k, v) => {
    if (!validators[k] || validators[k](v)) {
      setForm(f => ({ ...f, [k]: k === "rfc" ? v.toUpperCase() : v }))
      if (errors[k]) setErrors(e => ({ ...e, [k]: null }))
    }
  }

  const handleSave = async () => {
    const errs = validateRequired(form)
    if (!isEdit && existingRfcs.includes(form.rfc)) errs.rfc = "Este RFC ya está registrado"
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    setApiError("")
    try {
      const url    = isEdit ? `/api/clientes/${form.rfc}` : "/api/clientes"
      const method = isEdit ? "PUT" : "POST"
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setApiError(data.error || "Error al guardar"); setSaving(false); return }
      onSave(data)
    } catch {
      setApiError("Error de conexión")
      setSaving(false)
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(8,15,30,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem", animation:"fadeIn 0.2s ease-out" }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={{ background:"#fff", borderRadius:"18px", width:"100%", maxWidth:"600px", boxShadow:"0 32px 80px rgba(8,15,30,0.25)", animation:"modalIn 0.35s cubic-bezier(0.34,1.4,0.64,1)", overflow:"hidden" }}>
        <div style={{ background:"var(--navy)", padding:"1.4rem 1.75rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.3rem", fontWeight:700, color:"#fff", letterSpacing:"0.05em" }}>{isEdit?"EDITAR CLIENTE":"NUEVO CLIENTE"}</h3>
            <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"0.78rem" }}>{isEdit?`RFC: ${cliente.rfc}`:"Complete los datos del cliente"}</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.1)", border:"none", borderRadius:"8px", padding:"0.5rem", color:"#fff", cursor:"pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ height:"3px", background:"var(--red)" }} />

        <div style={{ padding:"1.75rem" }}>
          {apiError && (
            <div style={{ background:"#FFF0F2", border:"1px solid var(--red)", borderRadius:"10px", padding:"0.75rem 1rem", color:"var(--red)", fontSize:"0.85rem", marginBottom:"1rem" }}>{apiError}</div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 1.25rem" }}>
            <div style={{ gridColumn:"1/-1" }}>
              <FormField label="RFC" required error={errors.rfc} hint="Formato: XXXX000000XX0 (12-13 caracteres)">
                <input value={form.rfc} onChange={e => handleChange("rfc", e.target.value)}
                  placeholder="XXXX000000XX0" maxLength={13} disabled={isEdit}
                  style={{ ...inputStyle(!!errors.rfc), opacity:isEdit?0.6:1, fontFamily:"monospace", letterSpacing:"0.1em" }} />
                {!errors.rfc && form.rfc && <p style={{ fontSize:"0.68rem", color:"#9CA3AF", marginTop:"0.3rem" }}>{form.rfc.length}/13 caracteres</p>}
              </FormField>
            </div>
            <FormField label="Nombre(s)" required error={errors.nombre}>
              <input value={form.nombre} onChange={e => handleChange("nombre", e.target.value)} placeholder="Nombre(s)" style={inputStyle(!!errors.nombre)} />
            </FormField>
            <FormField label="Apellido Paterno" required error={errors.apellido_paterno}>
              <input value={form.apellido_paterno} onChange={e => handleChange("apellido_paterno", e.target.value)} placeholder="Apellido paterno" style={inputStyle(!!errors.apellido_paterno)} />
            </FormField>
            <FormField label="Apellido Materno" error={errors.apellido_materno}>
              <input value={form.apellido_materno} onChange={e => handleChange("apellido_materno", e.target.value)} placeholder="Apellido materno" style={inputStyle(!!errors.apellido_materno)} />
            </FormField>
            <FormField label="Teléfono" error={errors.telefono} hint="10 dígitos">
              <input value={form.telefono} onChange={e => handleChange("telefono", e.target.value)} placeholder="6691234567" maxLength={10} inputMode="numeric" style={inputStyle(!!errors.telefono)} />
              {!errors.telefono && form.telefono && <p style={{ fontSize:"0.68rem", color:form.telefono.length===10?"#15803D":"#9CA3AF", marginTop:"0.3rem" }}>{form.telefono.length}/10</p>}
            </FormField>
            <div style={{ gridColumn:"1/-1" }}>
              <FormField label="Correo" error={errors.correo}>
                <input type="email" value={form.correo} onChange={e => handleChange("correo", e.target.value)} placeholder="correo@ejemplo.com" style={inputStyle(!!errors.correo)} />
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

export default function ClientesPage() {
  const [clientes, setClientes]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState("")
  const [modal, setModal]         = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [deleting, setDeleting]   = useState(false)

  const fetchClientes = async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/clientes")
      const data = await res.json()
      setClientes(data)
    } catch { /* error silencioso */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchClientes() }, [])

  const filtered = clientes.filter(c =>
    `${c.nombre} ${c.apellido_paterno} ${c.apellido_materno} ${c.rfc}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = () => { setModal(null); fetchClientes() }

  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`/api/clientes/${delTarget.rfc}`, { method: "DELETE" })
    setDelTarget(null)
    setDeleting(false)
    fetchClientes()
  }

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2rem" }}>
        <div>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"2rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.04em" }}>CLIENTES</h1>
          <p style={{ color:"#9CA3AF", fontSize:"0.875rem", marginTop:"0.2rem" }}>{clientes.length} cliente{clientes.length!==1?"s":""} registrado{clientes.length!==1?"s":""}</p>
        </div>
        <button onClick={() => setModal("new")} style={{ display:"flex", alignItems:"center", gap:"0.5rem", background:"var(--red)", color:"#fff", border:"none", borderRadius:"10px", padding:"0.7rem 1.25rem", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.85rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", boxShadow:"0 4px 14px rgba(200,16,46,0.3)" }}
          onMouseEnter={e => e.currentTarget.style.background="var(--red-dark)"}
          onMouseLeave={e => e.currentTarget.style.background="var(--red)"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo Cliente
        </button>
      </div>

      <div style={{ position:"relative", marginBottom:"1.5rem" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ position:"absolute", left:"1rem", top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, RFC..." style={{ width:"100%", maxWidth:"360px", padding:"0.75rem 1rem 0.75rem 2.75rem", border:"2px solid var(--border)", borderRadius:"10px", fontSize:"0.875rem", color:"var(--navy)", background:"#fff", fontFamily:"'Barlow',sans-serif" }} />
      </div>

      <div style={{ background:"#fff", borderRadius:"16px", border:"1px solid var(--border)", overflow:"hidden", boxShadow:"0 4px 24px rgba(15,31,61,0.06)" }}>
        {loading ? (
          <div style={{ padding:"3rem", textAlign:"center", color:"#9CA3AF" }}>
            <span style={{ display:"inline-block", width:"28px", height:"28px", border:"3px solid var(--border)", borderTopColor:"var(--red)", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
            <p style={{ marginTop:"1rem" }}>Cargando clientes...</p>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"var(--navy)" }}>
                {["RFC","Nombre completo","Teléfono","Correo","Acciones"].map(col => (
                  <th key={col} style={{ padding:"0.9rem 1.25rem", textAlign:"left", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.14em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding:"3rem", textAlign:"center", color:"#9CA3AF" }}>No se encontraron clientes</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c.rfc} style={{ background:i%2===0?"#fff":"#FAFBFC", borderBottom:"1px solid var(--border)" }}
                  onMouseEnter={e => e.currentTarget.style.background="#F0F4FF"}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?"#fff":"#FAFBFC"}>
                  <td style={{ padding:"0.95rem 1.25rem" }}>
                    <span style={{ fontFamily:"monospace", fontSize:"0.8rem", background:"#E8ECF4", color:"var(--navy)", padding:"0.25rem 0.6rem", borderRadius:"6px", letterSpacing:"0.05em" }}>{c.rfc}</span>
                  </td>
                  <td style={{ padding:"0.95rem 1.25rem", fontSize:"0.9rem", color:"var(--navy)", fontWeight:500 }}>{c.nombre} {c.apellido_paterno} {c.apellido_materno}</td>
                  <td style={{ padding:"0.95rem 1.25rem", fontSize:"0.875rem", color:"#4B5563" }}>{c.telefono||"—"}</td>
                  <td style={{ padding:"0.95rem 1.25rem", fontSize:"0.875rem", color:"#4B5563" }}>{c.correo||"—"}</td>
                  <td style={{ padding:"0.95rem 1.25rem" }}>
                    <div style={{ display:"flex", gap:"0.5rem" }}>
                      <button onClick={() => setModal(c)} style={{ display:"flex", alignItems:"center", gap:"0.35rem", padding:"0.4rem 0.75rem", background:"#E8ECF4", border:"none", borderRadius:"7px", color:"var(--navy)", fontSize:"0.78rem", fontWeight:600, cursor:"pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background="#C5CDE0"}
                        onMouseLeave={e => e.currentTarget.style.background="#E8ECF4"}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Editar
                      </button>
                      <button onClick={() => setDelTarget(c)} style={{ display:"flex", alignItems:"center", gap:"0.35rem", padding:"0.4rem 0.75rem", background:"#FFF0F2", border:"none", borderRadius:"7px", color:"var(--red)", fontSize:"0.78rem", fontWeight:600, cursor:"pointer" }}
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
          <span style={{ fontSize:"0.8rem", color:"#9CA3AF" }}>Mostrando {filtered.length} de {clientes.length} clientes</span>
        </div>
      </div>

      {modal !== null && (
        <ClienteModal cliente={modal==="new"?null:modal} onClose={() => setModal(null)} onSave={handleSave} existingRfcs={clientes.map(c=>c.rfc)} />
      )}

      {delTarget && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(8,15,30,0.6)", display:"flex", alignItems:"center", justifyContent:"center", animation:"fadeIn 0.2s ease-out" }}>
          <div style={{ background:"#fff", borderRadius:"16px", padding:"2rem", maxWidth:"420px", width:"90%", animation:"modalIn 0.3s cubic-bezier(0.34,1.4,0.64,1)" }}>
            <div style={{ width:"56px", height:"56px", background:"#FFF0F2", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1rem" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </div>
            <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.2rem", color:"var(--navy)", marginBottom:"0.75rem", textAlign:"center" }}>¿Eliminar cliente?</h3>
            <div style={{ background:"#F9FAFB", borderRadius:"10px", padding:"0.875rem 1rem", marginBottom:"1.25rem", border:"1px solid var(--border)" }}>
              <p style={{ fontWeight:700, fontSize:"0.9rem", color:"var(--navy)" }}>{delTarget.nombre} {delTarget.apellido_paterno} {delTarget.apellido_materno}</p>
              <p style={{ fontSize:"0.75rem", color:"#9CA3AF", fontFamily:"monospace", marginTop:"0.2rem" }}>{delTarget.rfc}</p>
            </div>
            <p style={{ color:"#9CA3AF", fontSize:"0.82rem", marginBottom:"1.25rem", textAlign:"center" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display:"flex", gap:"0.75rem", justifyContent:"center" }}>
              <button onClick={() => setDelTarget(null)} style={{ padding:"0.7rem 1.5rem", border:"2px solid var(--border)", borderRadius:"10px", background:"#fff", color:"var(--navy)", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.82rem", fontWeight:700, letterSpacing:"0.1em", cursor:"pointer" }}>CANCELAR</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding:"0.7rem 1.5rem", border:"none", borderRadius:"10px", background:deleting?"#9CA3AF":"var(--red)", color:"#fff", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.82rem", fontWeight:700, letterSpacing:"0.1em", cursor:deleting?"not-allowed":"pointer" }}>
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
