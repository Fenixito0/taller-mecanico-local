"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [form, setForm]         = useState({ username: "", password: "" })
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")
  const [showPass, setShowPass] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const result = await signIn("credentials", {
      username: form.username,
      password: form.password,
      redirect: false,
    })

if (result?.ok) {
  router.push("/clientes")
  router.refresh()
} else {
  setError(result?.error || "Usuario o contraseña incorrectos.")
  setLoading(false)
}
  }

  const labelStyle = {
    display: "block", fontSize: "0.7rem", fontWeight: 700,
    color: "var(--navy)", textTransform: "uppercase",
    letterSpacing: "0.12em", marginBottom: "0.5rem",
    fontFamily: "'Barlow Condensed', sans-serif",
  }
  const inputStyle = {
    width: "100%", padding: "0.9rem 1rem",
    border: "2px solid var(--border)", borderRadius: "10px",
    fontSize: "0.95rem", color: "var(--navy)",
    background: "#FAFAFA", transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "'Barlow', sans-serif",
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Barlow', sans-serif" }}>

      {/* Panel izquierdo */}
      <div style={{ width: "44%", background: "linear-gradient(155deg, var(--navy-dark) 0%, var(--navy) 55%, var(--navy-light) 100%)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "3rem", position: "relative", overflow: "hidden" }}>
        {[{ top:"-120px", right:"-120px", size:"420px", opacity:0.12 }, { bottom:"-160px", left:"-120px", size:"520px", opacity:0.08 }, { top:"40%", right:"-60px", size:"200px", opacity:0.07 }].map((c,i) => (
          <div key={i} style={{ position:"absolute", top:c.top, bottom:c.bottom, right:c.right, left:c.left, width:c.size, height:c.size, borderRadius:"50%", border:`1px solid rgba(200,16,46,${c.opacity})` }} />
        ))}
        <div style={{ position:"absolute", top:0, left:0, width:"4px", height:"100%", background:"linear-gradient(to bottom, transparent, var(--red), transparent)" }} />
        <div style={{ textAlign:"center", zIndex:1, animation:"slideUp 0.6s ease-out" }}>
          <div style={{ width:"88px", height:"88px", background:"var(--red)", borderRadius:"22px", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 2rem", boxShadow:"0 12px 40px rgba(200,16,46,0.4)" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"2.6rem", fontWeight:800, color:"#FFF", letterSpacing:"0.06em", lineHeight:1.1, marginBottom:"0.4rem" }}>TALLER<br/>MECÁNICO</h1>
          <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"0.72rem", letterSpacing:"0.22em", textTransform:"uppercase", marginBottom:"2rem" }}>SISTEMA DE GESTIÓN</p>
          <div style={{ width:"50px", height:"3px", background:"var(--red)", margin:"0 auto 2rem" }} />
          <p style={{ color:"rgba(255,255,255,0.38)", fontSize:"0.85rem", maxWidth:"270px", lineHeight:1.7 }}>Gestión integral de clientes, vehículos, refacciones y servicios</p>
          <div style={{ display:"flex", gap:"1.5rem", justifyContent:"center", marginTop:"3rem" }}>
            {["Clientes","Vehículos","Servicios"].map(label => (
              <div key={label} style={{ textAlign:"center" }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"var(--red)", margin:"0 auto 0.4rem" }} />
                <span style={{ color:"rgba(255,255,255,0.3)", fontSize:"0.7rem", letterSpacing:"0.1em" }}>{label.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{ flex:1, background:"var(--gray-bg)", display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem" }}>
        <div style={{ background:"#FFF", borderRadius:"20px", padding:"3rem", width:"100%", maxWidth:"420px", boxShadow:"0 24px 80px rgba(15,31,61,0.1)", animation:"slideUp 0.5s ease-out" }}>
          <div style={{ marginBottom:"2rem" }}>
            <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.9rem", fontWeight:700, color:"var(--navy)", letterSpacing:"0.04em", marginBottom:"0.4rem" }}>INICIAR SESIÓN</h2>
            <p style={{ color:"#9CA3AF", fontSize:"0.88rem" }}>Ingrese sus credenciales para acceder al sistema</p>
          </div>

          {error && (
            <div style={{ background:"var(--red-light,#FFF0F2)", border:"1px solid var(--red)", borderRadius:"10px", padding:"0.8rem 1rem", color:"var(--red)", fontSize:"0.85rem", marginBottom:"1.5rem", display:"flex", alignItems:"center", gap:"0.5rem", animation:"slideUp 0.3s ease-out" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:"1.4rem" }}>
              <label style={labelStyle}>Usuario</label>
              <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required placeholder="Ingrese su usuario" style={inputStyle} />
            </div>
            <div style={{ marginBottom:"2rem" }}>
              <label style={labelStyle}>Contraseña</label>
              <div style={{ position:"relative" }}>
                <input type={showPass?"text":"password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required placeholder="Ingrese su contraseña" style={{ ...inputStyle, paddingRight:"3rem" }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position:"absolute", right:"1rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#9CA3AF", display:"flex", alignItems:"center" }}>
                  {showPass
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{ width:"100%", padding:"1rem", background:loading?"#9CA3AF":"var(--red)", color:"#FFF", border:"none", borderRadius:"10px", fontSize:"0.85rem", fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.15em", textTransform:"uppercase", cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.6rem" }}
              onMouseEnter={e => { if (!loading) e.target.style.background="var(--red-dark)" }}
              onMouseLeave={e => { if (!loading) e.target.style.background="var(--red)" }}>
              {loading
                ? <><span style={{ width:"16px", height:"16px", border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" }} />VERIFICANDO...</>
                : "INGRESAR AL SISTEMA"
              }
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes slideUp { from { transform:translateY(28px); opacity:0 } to { transform:translateY(0); opacity:1 } }
        @keyframes spin    { to   { transform:rotate(360deg) } }
      `}</style>
    </div>
  )
}
