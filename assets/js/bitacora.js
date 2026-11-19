"use strict"

;(() => {
  let pagina = 1
  let modulosCargados = false

  async function cargar() {
    const p = new URLSearchParams({ pagina: String(pagina) })
    const q = $("#search").value.trim()
    if (q) p.set("q", q)
    if ($("#modulo").value) p.set("modulo", $("#modulo").value)
    if ($("#desde").value) p.set("desde", $("#desde").value)
    if ($("#hasta").value) p.set("hasta", $("#hasta").value)
    const { ok, data } = await api(`api/bitacora.php?${p}`)
    if (!ok) {
      $("#table-wrap").innerHTML = `<div class="alert" style="margin:1rem">${esc(data.error || "No se pudo cargar la bitácora")}</div>`
      return
    }
    if (!modulosCargados) {
      $("#modulo").insertAdjacentHTML("beforeend", data.modulos.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join(""))
      modulosCargados = true
    }
    render(data)
  }

  function render(d) {
    $("#count-label").textContent = `${d.total} registro${plural(d.total)}`
    const rows = d.items.length === 0
      ? '<tr><td colspan="4" class="empty">No hay registros con esos filtros</td></tr>'
      : d.items.map((a) => {
        const f = new Date(a.fecha)
        return `
        <tr class="row">
          <td style="font-size:0.82rem;white-space:nowrap">${esc(f.toLocaleDateString("es-MX"))} <span class="muted">${esc(f.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }))}</span></td>
          <td><span class="tag">${esc(a.username || "—")}</span></td>
          <td><span class="pill">${esc(a.modulo)}</span></td>
          <td style="color:var(--navy)">${esc(a.accion)}</td>
        </tr>`
      }).join("")
    $("#table-wrap").innerHTML = `
      <table class="table">
        <thead><tr><th>Fecha</th><th>Usuario</th><th>Módulo</th><th>Acción</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    $("#foot").innerHTML = `
      <span>Página ${d.pagina} de ${d.paginas}</span>
      <span class="flex" style="gap:0.5rem">
        <button type="button" class="btn btn-outline btn-sm" data-pag="${d.pagina - 1}" ${d.pagina <= 1 ? "disabled" : ""}>‹ Anterior</button>
        <button type="button" class="btn btn-outline btn-sm" data-pag="${d.pagina + 1}" ${d.pagina >= d.paginas ? "disabled" : ""}>Siguiente ›</button>
      </span>`
  }

  const recargar = () => { pagina = 1; cargar() }
  $("#search").addEventListener("input", debounce(recargar, 300))
  ;["#modulo", "#desde", "#hasta"].forEach((s) => $(s).addEventListener("change", recargar))
  $("#foot").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pag]")
    if (!b || b.disabled) return
    pagina = Number(b.dataset.pag)
    cargar()
  })
  cargar()
})()
