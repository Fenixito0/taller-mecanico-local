"use strict"

;(() => {
  let clientes = []

  async function cargar() {
    const { ok, data } = await api("api/clientes.php")
    clientes = ok && Array.isArray(data) ? data : []
    $("#count-label").textContent = `${clientes.length} cliente${plural(clientes.length)} registrado${plural(clientes.length)}`
    render()
  }

  function render() {
    const q = norm($("#search").value)
    const filtered = clientes.filter((c) =>
      norm(`${c.nombre} ${c.apellido_paterno} ${c.apellido_materno || ""} ${c.rfc} ${c.telefono || ""} ${c.correo || ""}`).includes(q))

    const rows = filtered.length === 0
      ? `<tr><td colspan="5" class="empty">${clientes.length === 0 ? "Aún no hay clientes. Usa «Nuevo cliente» para registrar el primero." : "No se encontraron clientes"}</td></tr>`
      : filtered.map((c) => `
        <tr class="row">
          <td><span class="tag">${esc(c.rfc)}</span></td>
          <td class="td-strong">${esc(c.nombre)} ${esc(c.apellido_paterno)} ${esc(c.apellido_materno || "")}</td>
          <td>${c.telefono ? `<a class="link" href="tel:${esc(c.telefono)}">${esc(c.telefono)}</a>` : "—"}</td>
          <td>${c.correo ? `<a class="link" href="mailto:${esc(c.correo)}">${esc(c.correo)}</a>` : "—"}</td>
          <td><div class="actions">
            <button type="button" class="act-btn act-edit" data-edit="${esc(c.rfc)}">${ICON.edit}Editar</button>
            ${ES_ADMIN ? `<button type="button" class="act-btn act-del" data-del="${esc(c.rfc)}">${ICON.trash}Eliminar</button>` : ""}
          </div></td>
        </tr>`).join("")

    $("#table-wrap").innerHTML = `
      <table class="table">
        <thead><tr><th>RFC</th><th>Nombre completo</th><th>Teléfono</th><th>Correo</th><th>Acciones</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    $("#foot").textContent = `Mostrando ${filtered.length} de ${clientes.length} clientes`
  }

  const abrir = (cliente) => Forms.cliente({ cliente, existentes: clientes, onSaved: cargar })

  function eliminar(c) {
    confirmDialog({
      title: "¿Eliminar cliente?",
      detail: `<p class="t">${esc(c.nombre)} ${esc(c.apellido_paterno)} ${esc(c.apellido_materno || "")}</p><p class="m">${esc(c.rfc)}</p>`,
      note: "Esta acción no se puede deshacer.",
      onConfirm: async () => {
        const { ok, data } = await api(`api/clientes.php?rfc=${encodeURIComponent(c.rfc)}`, { method: "DELETE" })
        if (!ok) return data.error || "Error al eliminar cliente"
        toast("Cliente eliminado")
        cargar()
        return null
      },
    })
  }

  $("#btn-new").addEventListener("click", () => abrir(null))
  $("#search").addEventListener("input", debounce(render))
  $("#table-wrap").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit]")
    const del = e.target.closest("[data-del]")
    if (ed) abrir(clientes.find((c) => c.rfc === ed.dataset.edit))
    if (del) eliminar(clientes.find((c) => c.rfc === del.dataset.del))
  })

  cargar()
})()
