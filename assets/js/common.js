/* Utilidades compartidas por todas las páginas del panel. */
"use strict"

const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || ""

/**
 * Llama a la API y devuelve { ok, status, data }.
 * @param {string} url
 * @param {{method?:string, body?:object, noRedirect?:boolean}} [opts]
 */
async function api(url, opts = {}) {
  const init = { method: opts.method || "GET", headers: { "X-CSRF-Token": CSRF }, credentials: "same-origin" }
  if (opts.body !== undefined) {
    init.headers["Content-Type"] = "application/json"
    init.body = JSON.stringify(opts.body)
  }
  const res = await fetch(url, init)
  if (res.status === 401 && !opts.noRedirect) {
    location.href = `login.php?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`
    return { ok: false, status: 401, data: {} }
  }
  let data = {}
  try { data = await res.json() } catch { data = {} }
  return { ok: res.ok, status: res.status, data }
}

/** Escapa texto para insertarlo en HTML de forma segura. */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))

const pad4 = (n) => String(n).padStart(4, "0")
const money = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtMXN = (n) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const plural = (n, s = "s") => (n !== 1 ? s : "")
const fechaCorta = (iso) => new Date(iso).toLocaleDateString("es-MX")
const fechaLarga = (iso) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })
const fechaMes = (iso) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })

const LADO_LABELS = { izquierdo: "Izquierdo", derecho: "Derecho", central: "Central", NA: "N/A" }
const LADO_CORTO = { izquierdo: "Izq", derecho: "Der", central: "Cen", NA: "N/A" }
const METODO_LABEL = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" }
const ESTADO_LABEL = { pendiente: "Pendiente", completado: "Completado", cancelado: "Cancelado" }
const ETAPA_LABEL = { recibido: "Recibido", reparacion: "En reparación", listo: "Listo para entregar" }
const ES_ADMIN = document.querySelector('meta[name="user-rol"]')?.content === "admin"

/**
 * Enlace de WhatsApp con el mensaje ya escrito (no envía nada por sí solo).
 * @param {string|null} telefono 10 dígitos (México)
 * @param {string} mensaje
 * @returns {string|null}
 */
function whatsappUrl(telefono, mensaje) {
  const tel = String(telefono || "").replace(/\D/g, "")
  if (tel.length < 10) return null
  const intl = tel.length === 10 ? `52${tel}` : tel
  return `https://wa.me/${intl}?text=${encodeURIComponent(mensaje)}`
}

const km = (n) => (n === null || n === undefined || n === "" ? "—" : `${Number(n).toLocaleString("es-MX")} km`)

const ladoBadge = (lado, corto = false) =>
  `<span class="badge${corto ? " xs" : ""} lado-${esc(lado in LADO_LABELS ? lado : "NA")}">${esc((corto ? LADO_CORTO : LADO_LABELS)[lado] || lado)}</span>`

/** Iconos SVG reutilizables */
const ICON = {
  edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>',
  trashLg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  alert: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  check: (s = 12) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,
  chevDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>',
  money: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  xCircle: (s = 13, c = "currentColor") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  wrench: (s = 14, c = "var(--navy)") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
}

/** Símbolos de línea (reemplazan a los emojis). Usan el color del texto (currentColor). */
const SYM_PATHS = {
  user: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  car: '<path d="M5 17h14M5 17a2 2 0 11-4 0v-5l2.5-5h11L19 12h2a2 2 0 012 2v3h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',
  note: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="5" y1="15" x2="9" y2="15"/>',
  bank: '<path d="M3 10l9-6 9 6"/><line x1="5" y1="10" x2="5" y2="18"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="14" y1="10" x2="14" y2="18"/><line x1="19" y1="10" x2="19" y2="18"/><line x1="3" y1="21" x2="21" y2="21"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
}
/**
 * @param {keyof typeof SYM_PATHS} name
 * @param {number} [size]
 * @param {string} [color]
 */
const sym = (name, size = 18, color = "currentColor") =>
  `<svg class="sym" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SYM_PATHS[name]}</svg>`

/** Muestra un modal de confirmación de borrado/cancelación. Devuelve el elemento overlay. */
function confirmDialog({ icon = ICON.trashLg, iconClass = "", title, detail, note, cancelText = "CANCELAR", okText = "ELIMINAR", busyText = "ELIMINANDO...", okClass = "btn-primary", onConfirm }) {
  const ov = document.createElement("div")
  ov.className = "overlay confirm"
  ov.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon ${iconClass}">${icon}</div>
      <h3>${esc(title)}</h3>
      <div class="confirm-detail">${detail}</div>
      <p class="confirm-note">${esc(note)}</p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-outline" data-act="cancel">${esc(cancelText)}</button>
        <button type="button" class="btn ${okClass}" data-act="ok">${esc(okText)}</button>
      </div>
      <p class="ferr" data-err hidden></p>
    </div>`
  const close = () => ov.remove()
  ov._close = close
  ov.querySelector('[data-act="cancel"]').onclick = close
  const okBtn = ov.querySelector('[data-act="ok"]')
  okBtn.onclick = async () => {
    okBtn.disabled = true
    okBtn.textContent = busyText
    const err = await onConfirm()
    if (err) {
      const p = ov.querySelector("[data-err]")
      p.textContent = err
      p.hidden = false
      p.style.justifyContent = "center"
      okBtn.disabled = false
      okBtn.textContent = okText
      return
    }
    close()
  }
  document.body.appendChild(ov)
  ov.querySelector('[data-act="cancel"]').focus()
  return ov
}

/**
 * Notificación breve en la esquina inferior.
 * @param {string} msg
 * @param {"ok"|"error"|"info"} [tipo]
 */
function toast(msg, tipo = "ok") {
  let box = document.getElementById("toasts")
  if (!box) {
    box = document.createElement("div")
    box.id = "toasts"
    box.setAttribute("aria-live", "polite")
    document.body.appendChild(box)
  }
  const t = document.createElement("div")
  t.className = `toast toast-${tipo}`
  t.innerHTML = `${tipo === "error" ? ICON.xCircle(16) : ICON.check(14).replace('stroke="white"', 'stroke="currentColor"')}<span>${esc(msg)}</span>`
  box.appendChild(t)
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300) }, 3200)
}

/** Debounce simple para búsquedas. */
function debounce(fn, ms = 150) {
  let id
  return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms) }
}

/** Normaliza texto para búsquedas (sin acentos, minúsculas). */
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Descarga un archivo navegando a la URL (la sesión viaja en la cookie). */
function descargar(url) {
  const a = document.createElement("a")
  a.href = url
  a.download = ""
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Fecha local en formato YYYY-MM-DD */
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ── Sidebar: colapsar y cerrar sesión ────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const btnCollapse = document.getElementById("btn-collapse")
  if (btnCollapse) {
    btnCollapse.addEventListener("click", () => {
      const on = document.documentElement.classList.toggle("collapsed")
      localStorage.setItem("sidebarCollapsed", on ? "1" : "0")
    })
  }
  // Menú lateral en pantallas pequeñas
  const btnMenu = document.getElementById("btn-menu")
  if (btnMenu) {
    const backdrop = document.createElement("div")
    backdrop.className = "side-backdrop"
    document.body.appendChild(backdrop)
    const toggle = (on) => document.documentElement.classList.toggle("menu-open", on)
    btnMenu.addEventListener("click", () => toggle(true))
    backdrop.addEventListener("click", () => toggle(false))
  }

  // Atajos globales: Esc cierra el modal superior, "/" enfoca el buscador, Alt+N nueva orden
  document.addEventListener("keydown", (e) => {
    const overlays = $$(".overlay")
    if (e.key === "Escape" && document.documentElement.classList.contains("menu-open")) {
      document.documentElement.classList.remove("menu-open")
      return
    }
    if (e.key === "Escape" && overlays.length > 0) {
      const top = overlays[overlays.length - 1]
      if (top._close) top._close()
      else top.remove()
      return
    }
    const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")
    if (e.key === "/" && !escribiendo && overlays.length === 0) {
      const s = document.querySelector("[data-search]")
      if (s) { e.preventDefault(); s.focus(); s.select() }
    }
    if (e.altKey && (e.key === "n" || e.key === "N") && !location.pathname.endsWith("orden_nueva.php")) {
      e.preventDefault()
      location.href = "orden_nueva.php"
    }
  })

  // Aviso tras redirecciones (p. ej. ?ok=...)
  const flash = sessionStorage.getItem("flash")
  if (flash) {
    sessionStorage.removeItem("flash")
    toast(flash)
  }

  // Tema claro / oscuro
  const btnTema = document.getElementById("btn-tema")
  if (btnTema) {
    btnTema.addEventListener("click", () => {
      const on = document.documentElement.classList.toggle("dark")
      localStorage.setItem("tema", on ? "oscuro" : "claro")
    })
  }

  // Mi cuenta: cambiar contraseña
  const btnCuenta = document.getElementById("btn-cuenta")
  if (btnCuenta) btnCuenta.addEventListener("click", abrirCambioPassword)

  const btnLogout = document.getElementById("btn-logout")
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await api("api/auth.php?accion=logout", { method: "POST" })
      location.href = "login.php"
    })
  }
})

/** Modal para que el usuario cambie su propia contraseña. */
function abrirCambioPassword() {
  const ov = document.createElement("div")
  ov.className = "overlay"
  ov.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" style="max-width:440px">
      <div class="modal-head"><div><h3>CAMBIAR CONTRASEÑA</h3><p>Mínimo 8 caracteres</p></div>
        <button type="button" class="modal-close" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="red-line"></div>
      <form class="modal-body" data-form>
        <div class="alert" data-err hidden></div>
        <div class="field"><label class="label" for="pw-actual">Contraseña actual</label>
          <input class="input" id="pw-actual" type="password" autocomplete="current-password" required></div>
        <div class="field"><label class="label" for="pw-nueva">Nueva contraseña</label>
          <input class="input" id="pw-nueva" type="password" autocomplete="new-password" minlength="8" required></div>
        <div class="field"><label class="label" for="pw-conf">Confirmar nueva contraseña</label>
          <input class="input" id="pw-conf" type="password" autocomplete="new-password" minlength="8" required></div>
        <button type="submit" hidden></button>
      </form>
      <div class="modal-foot">
        <button type="button" class="btn btn-outline" data-close>CANCELAR</button>
        <button type="button" class="btn btn-primary" data-save style="box-shadow:none">GUARDAR</button>
      </div>
    </div>`
  const close = () => ov.remove()
  ov._close = close
  ov.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close))
  const err = ov.querySelector("[data-err]")
  const btn = ov.querySelector("[data-save]")
  const enviar = async () => {
    const actual = ov.querySelector("#pw-actual").value
    const nueva = ov.querySelector("#pw-nueva").value
    const conf = ov.querySelector("#pw-conf").value
    const fallo = !actual ? "Escribe tu contraseña actual"
      : nueva.length < 8 ? "La nueva contraseña debe tener al menos 8 caracteres"
      : nueva !== conf ? "Las contraseñas nuevas no coinciden" : ""
    if (fallo) { err.textContent = fallo; err.hidden = false; return }
    btn.disabled = true
    const { ok, data } = await api("api/usuarios.php?accion=mi_password", { method: "PUT", body: { actual, nueva } })
    btn.disabled = false
    if (!ok) { err.textContent = data.error || "No se pudo cambiar la contraseña"; err.hidden = false; return }
    close()
    toast("Contraseña actualizada")
  }
  btn.onclick = enviar
  ov.querySelector("[data-form]").addEventListener("submit", (e) => { e.preventDefault(); enviar() })
  document.body.appendChild(ov)
  ov.querySelector("#pw-actual").focus()
}

/**
 * Modal genérico pequeño con campos; onSubmit(valores) devuelve error (string) o null.
 * @param {{title:string, sub?:string, body:string, okText?:string, onSubmit:(ov:HTMLElement)=>Promise<string|null>}} o
 */
function miniModal({ title, sub = "", body, okText = "GUARDAR", onSubmit }) {
  const ov = document.createElement("div")
  ov.className = "overlay"
  ov.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" style="max-width:460px">
      <div class="modal-head"><div><h3>${title}</h3><p>${sub}</p></div>
        <button type="button" class="modal-close" data-close aria-label="Cerrar">${ICON.close}</button></div>
      <div class="red-line"></div>
      <div class="modal-body"><div class="alert" data-err hidden></div>${body}</div>
      <div class="modal-foot">
        <button type="button" class="btn btn-outline" data-close>CANCELAR</button>
        <button type="button" class="btn btn-primary" data-save style="box-shadow:none">${okText}</button>
      </div>
    </div>`
  const close = () => ov.remove()
  ov._close = close
  ov.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close))
  const err = ov.querySelector("[data-err]")
  const btn = ov.querySelector("[data-save]")
  btn.onclick = async () => {
    btn.disabled = true
    const fallo = await onSubmit(ov)
    btn.disabled = false
    if (fallo) { err.textContent = fallo; err.hidden = false; return }
    close()
  }
  ov.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); btn.click() }
  })
  document.body.appendChild(ov)
  ov.querySelector("input, select")?.focus()
  return ov
}

// ── Piezas por orden y cobro por conceptos (misma lógica que includes/cobro.php) ──
const TASA_IVA = 0.16
const r2 = (x) => Math.round(x * 100) / 100
const ESTADO_PIEZA_LABEL = { pendiente: "Pendiente", recibida: "Recibida", instalada: "Instalada", devuelta: "Devuelta" }
const ORIGEN_LABEL = { aseguradora: "Aseguradora", taller: "Taller" }
const TIPO_ORDEN_LABEL = { seguro: "Seguro", particular: "Particular" }

/** Chip de estado de una pieza. */
const piezaEstadoBadge = (estado) =>
  `<span class="pz-estado pz-${esc(estado)}">${esc(ESTADO_PIEZA_LABEL[estado] || estado)}</span>`

/** Chip que identifica un extra pedido por el cliente. */
const extraBadge = () => '<span class="extra-tag">EXTRA</span>'

/** ¿La pieza se le cobra al cliente? */
const piezaCobrable = (p) => p.estado !== "devuelta" && p.precio_unitario !== null && p.precio_unitario !== undefined && p.precio_unitario !== ""

/**
 * Desglose del cobro. Seguro: piezas cobrables + extras (+IVA) + deducible fijo (sin IVA ni descuento).
 * Particular: piezas cobrables + mano de obra + extras (+IVA).
 */
function calcularCobro({ tipo, piezas = [], cargos = [], deducible = 0, descTipo = "monto", descValor = 0, aplicaIva = true, anticipo = 0 }) {
  const seguro = tipo === "seguro"
  const importePiezas = r2(piezas.filter(piezaCobrable).reduce((s, p) => s + Number(p.precio_unitario) * Number(p.cantidad || 1), 0))
  const sumaCargos = (t) => r2(cargos.filter((c) => c.tipo === t).reduce((s, c) => s + (Number(c.monto) || 0), 0))
  const manoObra = seguro ? 0 : sumaCargos("mano_obra")
  const extras = sumaCargos("extra")
  const ded = seguro ? r2(Math.max(0, Number(deducible) || 0)) : 0
  const bruto = r2(importePiezas + manoObra + extras)
  const dv = Number(descValor) || 0
  const descuento = r2(descTipo === "porcentaje" ? bruto * Math.min(dv, 100) / 100 : Math.max(0, dv))
  const descInvalido = descuento > bruto + 0.001 || (descTipo === "porcentaje" && dv > 100)
  const base = r2(Math.max(0, bruto - descuento))
  const iva = aplicaIva ? r2(base * TASA_IVA) : 0
  const total = r2(base + iva + ded)
  const ant = Number(anticipo) || 0
  return {
    piezas: importePiezas, manoObra, extras, deducible: ded, bruto, descuento, descInvalido, base, iva, total,
    anticipo: ant, anticipoExcede: ant - total > 0.005, restante: r2(Math.max(0, total - ant)),
  }
}
