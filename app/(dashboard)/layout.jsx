"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"

const NAV_ITEMS = [
  {
    href: "/clientes", label: "Clientes",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  },
  {
    href: "/vehiculos", label: "Vehículos",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  },
  {
    href: "/refacciones", label: "Refacciones",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
  },
  {
    href: "/ordenes", label: "Generar Orden",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  },
  {
    href: "/ventas", label: "Cobrar Venta", disabled: true,
    tooltip: "Accede desde una orden en Generar Orden",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  },
]

export default function DashboardLayout({ children }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [tooltip,   setTooltip]   = useState(false)

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push("/login")
  }

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"'Barlow',sans-serif" }}>
      <aside style={{ width:collapsed?"72px":"240px", background:"linear-gradient(180deg, var(--navy-dark) 0%, var(--navy) 100%)", display:"flex", flexDirection:"column", transition:"width 0.3s cubic-bezier(0.4,0,0.2,1)", position:"fixed", top:0, left:0, bottom:0, zIndex:100, overflow:"hidden" }}>
        <div style={{ height:"3px", background:"var(--red)", flexShrink:0 }} />

        {/* Logo */}
        <div style={{ padding:collapsed?"1.4rem 0":"1.4rem 1.5rem", display:"flex", alignItems:"center", gap:"0.75rem", justifyContent:collapsed?"center":"flex-start", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          <div style={{ width:"36px", height:"36px", background:"var(--red)", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          </div>
          {!collapsed && (
            <div>
              <p style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.95rem", fontWeight:700, color:"#FFF", letterSpacing:"0.08em", whiteSpace:"nowrap" }}>TALLER MECÁNICO</p>
              <p style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.3)", letterSpacing:"0.15em" }}>SISTEMA DE GESTIÓN</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"1rem 0", overflowY:"auto" }}>
          {!collapsed && <p style={{ fontSize:"0.6rem", fontWeight:700, color:"rgba(255,255,255,0.25)", letterSpacing:"0.18em", textTransform:"uppercase", padding:"0 1.5rem", marginBottom:"0.5rem" }}>MÓDULOS</p>}
          {NAV_ITEMS.map((item) => {
            const isActive = !item.disabled && (pathname === item.href || pathname.startsWith(item.href + "/"))
            if (item.disabled) {
              return (
                <div key={item.href} style={{ padding:"0.15rem 0.75rem", position:"relative" }}
                  onMouseEnter={() => setTooltip(item.href)}
                  onMouseLeave={() => setTooltip(false)}>
                  <div style={{ display:"flex", alignItems:"center", gap:"0.85rem", padding:collapsed?"0.75rem 0":"0.75rem 0.875rem", borderRadius:"10px", color:"rgba(255,255,255,0.2)", cursor:"not-allowed", justifyContent:collapsed?"center":"flex-start", borderLeft:"3px solid transparent" }}>
                    {item.icon}
                    {!collapsed && (
                      <>
                        <span style={{ fontSize:"0.88rem", fontWeight:400, flex:1 }}>{item.label}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </>
                    )}
                  </div>
                  {tooltip === item.href && !collapsed && (
                    <div style={{ position:"absolute", left:"calc(100% + 8px)", top:"50%", transform:"translateY(-50%)", background:"#1E293B", color:"#fff", fontSize:"0.75rem", padding:"0.5rem 0.875rem", borderRadius:"8px", whiteSpace:"nowrap", zIndex:200, boxShadow:"0 4px 16px rgba(0,0,0,0.3)", pointerEvents:"none" }}>
                      <div style={{ position:"absolute", right:"100%", top:"50%", transform:"translateY(-50%)", borderWidth:"5px", borderStyle:"solid", borderColor:"transparent #1E293B transparent transparent" }} />
                      {item.tooltip}
                    </div>
                  )}
                </div>
              )
            }
            return (
              <div key={item.href} style={{ padding:"0.15rem 0.75rem" }}>
                <Link href={item.href} style={{ textDecoration:"none" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"0.85rem", padding:collapsed?"0.75rem 0":"0.75rem 0.875rem", borderRadius:"10px", background:isActive?"rgba(200,16,46,0.18)":"transparent", color:isActive?"#FFFFFF":"rgba(255,255,255,0.5)", cursor:"pointer", transition:"all 0.2s", justifyContent:collapsed?"center":"flex-start", borderLeft:isActive?"3px solid var(--red)":"3px solid transparent" }}
                    onMouseEnter={e => { if (!isActive){ e.currentTarget.style.background="rgba(255,255,255,0.06)"; e.currentTarget.style.color="rgba(255,255,255,0.8)" }}}
                    onMouseLeave={e => { if (!isActive){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="rgba(255,255,255,0.5)" }}}>
                    {item.icon}
                    {!collapsed && <span style={{ fontSize:"0.88rem", fontWeight:isActive?600:400, whiteSpace:"nowrap" }}>{item.label}</span>}
                  </div>
                </Link>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"1rem 0.75rem", flexShrink:0 }}>
          <button onClick={() => setCollapsed(!collapsed)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:collapsed?"center":"flex-start", gap:"0.75rem", padding:"0.7rem 0.875rem", background:"rgba(255,255,255,0.05)", border:"none", borderRadius:"10px", color:"rgba(255,255,255,0.4)", cursor:"pointer", marginBottom:"0.5rem" }}
            onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.05)"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform:collapsed?"rotate(180deg)":"none", transition:"transform 0.3s" }}><polyline points="15 18 9 12 15 6"/></svg>
            {!collapsed && <span style={{ fontSize:"0.8rem" }}>Colapsar menú</span>}
          </button>
          <button onClick={handleLogout} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:collapsed?"center":"flex-start", gap:"0.75rem", padding:"0.7rem 0.875rem", background:"none", border:"none", borderRadius:"10px", color:"rgba(255,255,255,0.3)", cursor:"pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(200,16,46,0.15)"; e.currentTarget.style.color="var(--red)" }}
            onMouseLeave={e => { e.currentTarget.style.background="none"; e.currentTarget.style.color="rgba(255,255,255,0.3)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            {!collapsed && <span style={{ fontSize:"0.8rem" }}>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <main style={{ flex:1, marginLeft:collapsed?"72px":"240px", transition:"margin-left 0.3s cubic-bezier(0.4,0,0.2,1)", minHeight:"100vh", background:"var(--gray-bg)" }}>
        <header style={{ height:"60px", background:"#FFF", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"flex-end", padding:"0 2rem", position:"sticky", top:0, zIndex:50, boxShadow:"0 1px 8px rgba(15,31,61,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
            <div style={{ width:"34px", height:"34px", background:"var(--navy)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <p style={{ fontSize:"0.82rem", fontWeight:600, color:"var(--navy)" }}>Administrador</p>
              <p style={{ fontSize:"0.7rem", color:"#9CA3AF" }}>admin</p>
            </div>
          </div>
        </header>
        <div style={{ padding:"2rem", animation:"fadeIn 0.35s ease-out" }}>
          {children}
        </div>
      </main>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
