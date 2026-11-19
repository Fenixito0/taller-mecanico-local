"use strict"

;(() => {
  const COLOR_MAP = { Blanco: "#F9FAFB", Negro: "#111827", Gris: "#6B7280", Plata: "#D1D5DB", Rojo: "#DC2626", Azul: "#2563EB", Verde: "#16A34A", Amarillo: "#CA8A04", Café: "#92400E", Naranja: "#EA580C" }

  let vehiculos = []
  let clientes = []

  async function cargar() {
    const [v, c] = await Promise.all([api("api/vehiculos.php"), api("api/clientes.php")])
    vehiculos = v.ok && Array.isArray(v.data) ? v.data : []
    clientes = c.ok && Array.isArray(c.data) ? c.data : []
    $("#count-label").textContent = `${vehiculos.length} vehículo${plural(vehiculos.length)} registrado${plural(vehiculos.length)}`
    render()
  }

  function render() {
    const q = norm($("#search").value)
    const filtered = vehiculos.filter((v) =>
      norm(`${v.marca || ""} ${v.modelo} ${v.placas} ${v.anio} ${v.color || ""} ${v.cliente || ""}`).includes(q))

    const rows = filtered.length === 0
      ? `<tr><td colspan="6" class="empty">${vehiculos.length === 0 ? "Aún no hay vehículos. Usa «Nuevo vehículo» para registrar el primero." : "No se encontraron vehículos"}</td></tr>`
      : filtered.map((v) => `
        <tr class="row">
          <td><span class="tag bold">${esc(v.placas)}</span></td>
          <td class="td-strong">${esc(v.marca || "")} ${esc(v.modelo)}</td>
          <td>${esc(v.anio)}</td>
          <td><div class="flex gap-sm" style="align-items:center">
            <span class="color-dot" style="background:${COLOR_MAP[v.color] || "#E5E7EB"}"></span>
            <span>${esc(v.color || "—")}</span>
          </div></td>
          <td>${esc(v.cliente || "—")}</td>
          <td><div class="actions">
            <button type="button" class="act-btn act-edit" data-edit="${v.id_vehiculo}">${ICON.edit}Editar</button>
            ${ES_ADMIN ? `<button type="button" class="act-btn act-del" data-del="${v.id_vehiculo}">${ICON.trash}Eliminar</button>` : ""}
          </div></td>
        </tr>`).join("")

    $("#table-wrap").innerHTML = `
      <table class="table">
        <thead><tr><th>Placas</th><th>Vehículo</th><th>Año</th><th>Color</th><th>Cliente</th><th>Acciones</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    $("#foot").textContent = `Mostrando ${filtered.length} de ${vehiculos.length} vehículos`
  }

  const abrir = (vehiculo) => Forms.vehiculo({ vehiculo, clientes, vehiculos, onSaved: cargar })

  function eliminar(v) {
    confirmDialog({
      title: "¿Eliminar vehículo?",
      detail: `<p class="t">${esc(v.marca || "")} ${esc(v.modelo)} ${esc(v.anio)}</p><p class="m">${esc(v.placas)}</p>`,
      note: "Esta acción no se puede deshacer.",
      onConfirm: async () => {
        const { ok, data } = await api(`api/vehiculos.php?id=${v.id_vehiculo}`, { method: "DELETE" })
        if (!ok) return data.error || "Error al eliminar vehículo"
        toast("Vehículo eliminado")
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
    if (ed) abrir(vehiculos.find((v) => v.id_vehiculo === Number(ed.dataset.edit)))
    if (del) eliminar(vehiculos.find((v) => v.id_vehiculo === Number(del.dataset.del)))
  })

  cargar()
})()
