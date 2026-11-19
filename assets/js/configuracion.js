"use strict"

;(() => {
  const CAMPOS = ["nombre_taller", "eslogan", "direccion", "telefono", "rfc", "mensaje_recibo"]
  const form = $("#cfg-form")
  const err = $("#cfg-err")

  let aseguradoras = []

  async function cargar() {
    const { ok, data } = await api("api/configuracion.php")
    if (!ok) return toast("No se pudo cargar la configuración", "error")
    CAMPOS.forEach((c) => { $(`#${c}`).value = data[c] || "" })
    aseguradoras = Array.isArray(data.aseguradoras) ? data.aseguradoras : []
    pintarAseguradoras()
  }

  // ── Aseguradoras ─────────────────────────────────────────────────
  function pintarAseguradoras() {
    $("#aseg-lista").innerHTML = aseguradoras.length === 0
      ? '<p class="muted" style="font-size:0.85rem">Sin aseguradoras: no se podrán crear órdenes de seguro.</p>'
      : aseguradoras.map((a, i) => `
        <div class="sum-row"><span style="font-weight:600;color:var(--navy)">${esc(a)}</span>
          <button type="button" class="x-btn" data-quitar-aseg="${i}" aria-label="Quitar ${esc(a)}">×</button></div>`).join("")
  }

  function errorAseg(msg) {
    $("#aseg-err").textContent = msg
    $("#aseg-err").hidden = !msg
  }

  function agregarAseguradora() {
    const nombre = $("#aseg-nueva").value.trim()
    if (!nombre) return errorAseg("Escribe el nombre de la aseguradora")
    if (aseguradoras.some((a) => a.toLowerCase() === nombre.toLowerCase())) return errorAseg(`"${nombre}" ya está en la lista`)
    aseguradoras = [...aseguradoras, nombre]
    $("#aseg-nueva").value = ""
    errorAseg("")
    pintarAseguradoras()
  }

  $("#aseg-add").addEventListener("click", agregarAseguradora)
  $("#aseg-nueva").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); agregarAseguradora() } })
  $("#aseg-lista").addEventListener("click", (e) => {
    const b = e.target.closest("[data-quitar-aseg]")
    if (!b) return
    aseguradoras = aseguradoras.filter((_, i) => i !== Number(b.dataset.quitarAseg))
    pintarAseguradoras()
  })
  $("#aseg-save").addEventListener("click", async () => {
    const btn = $("#aseg-save")
    btn.disabled = true
    const { ok, data } = await api("api/configuracion.php?seccion=aseguradoras", { method: "PUT", body: { aseguradoras } })
    btn.disabled = false
    if (!ok) return errorAseg(data.error || "No se pudieron guardar las aseguradoras")
    aseguradoras = data.aseguradoras
    errorAseg("")
    pintarAseguradoras()
    toast("Aseguradoras guardadas")
  })

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    err.hidden = true
    const body = Object.fromEntries(CAMPOS.map((c) => [c, $(`#${c}`).value.trim()]))
    body.rfc = body.rfc.toUpperCase()
    if (!body.nombre_taller) {
      err.textContent = "El nombre del taller es requerido"
      err.hidden = false
      return
    }
    if (body.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(body.rfc)) {
      err.textContent = "RFC inválido (12 o 13 caracteres)"
      err.hidden = false
      return
    }
    const btn = $("#cfg-save")
    btn.disabled = true
    const { ok, data } = await api("api/configuracion.php", { method: "PUT", body })
    btn.disabled = false
    if (!ok) {
      err.textContent = data.error || "No se pudo guardar"
      err.hidden = false
      return
    }
    sessionStorage.setItem("flash", "Configuración guardada")
    location.reload() // el nombre del taller aparece en el menú lateral
  })

  $("#btn-respaldo").addEventListener("click", () => {
    descargar("api/respaldo.php")
    toast("Generando respaldo… la descarga iniciará en un momento", "info")
  })

  cargar()
})()
