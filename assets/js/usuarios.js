"use strict"

;(() => {
  let usuarios = []
  const ROL_LABEL = { admin: "Administrador", empleado: "Empleado" }

  async function cargar() {
    const { ok, data } = await api("api/usuarios.php")
    usuarios = ok && Array.isArray(data) ? data : []
    const activos = usuarios.filter((u) => u.activo).length
    $("#count-label").textContent = `${usuarios.length} usuario${plural(usuarios.length)} · ${activos} activo${plural(activos)}`
    render()
  }

  function render() {
    const rows = usuarios.map((u) => `
      <tr class="row${u.activo ? "" : " inactive"}">
        <td><span class="tag bold">${esc(u.username)}</span></td>
        <td class="td-strong">${esc(u.nombre)}</td>
        <td><span class="badge ${u.rol === "admin" ? "b-info" : "b-gray"}">${ROL_LABEL[u.rol] || esc(u.rol)}</span></td>
        <td><span class="badge ${u.activo ? "b-ok" : "b-bad"}">${u.activo ? "Activo" : "Inactivo"}</span></td>
        <td style="font-size:0.82rem;color:var(--text-3)">${esc(fechaMes(u.created_at))}</td>
        <td><div class="actions"><button type="button" class="act-btn act-edit" data-edit="${u.id_usuario}">${ICON.edit}Editar</button></div></td>
      </tr>`).join("")
    $("#table-wrap").innerHTML = `
      <table class="table">
        <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Alta</th><th>Acciones</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="empty">Sin usuarios</td></tr>'}</tbody>
      </table>`
  }

  const rolSelect = (rol) => `<select class="input" id="u-rol">${Object.entries(ROL_LABEL).map(([v, l]) =>
    `<option value="${v}"${v === rol ? " selected" : ""}>${l}</option>`).join("")}</select>`

  function nuevo() {
    miniModal({
      title: "NUEVO USUARIO",
      sub: "Podrá iniciar sesión con estos datos",
      body: `
        <div class="field"><label class="label" for="u-user">Usuario <span class="req">*</span></label>
          <input class="input" id="u-user" maxlength="50" autocomplete="off" placeholder="ej. jperez">
          <p class="hint">3 a 50 caracteres: minúsculas, números, punto o guion</p></div>
        <div class="field"><label class="label" for="u-nombre">Nombre completo <span class="req">*</span></label>
          <input class="input" id="u-nombre" maxlength="100"></div>
        <div class="field"><label class="label" for="u-rol">Rol</label>${rolSelect("empleado")}</div>
        <div class="field"><label class="label" for="u-pass">Contraseña inicial <span class="req">*</span></label>
          <input class="input" id="u-pass" type="password" autocomplete="new-password" minlength="8">
          <p class="hint">Mínimo 8 caracteres. El usuario puede cambiarla desde su nombre, arriba a la derecha.</p></div>`,
      okText: "CREAR USUARIO",
      onSubmit: async (ov) => {
        const username = ov.querySelector("#u-user").value.trim().toLowerCase()
        const nombre = ov.querySelector("#u-nombre").value.trim()
        const password = ov.querySelector("#u-pass").value
        if (!/^[a-z0-9._-]{3,50}$/.test(username)) return "Usuario inválido: 3 a 50 caracteres (letras minúsculas, números, punto, guion)"
        if (!nombre) return "El nombre es requerido"
        if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres"
        const { ok, data } = await api("api/usuarios.php", {
          method: "POST", body: { username, nombre, rol: ov.querySelector("#u-rol").value, password },
        })
        if (!ok) return data.error || "No se pudo crear el usuario"
        toast(`Usuario ${username} creado`)
        cargar()
        return null
      },
    })
  }

  function editar(u) {
    miniModal({
      title: "EDITAR USUARIO",
      sub: esc(u.username),
      body: `
        <div class="field"><label class="label" for="u-nombre">Nombre completo</label>
          <input class="input" id="u-nombre" maxlength="100" value="${esc(u.nombre)}"></div>
        <div class="field"><label class="label" for="u-rol">Rol</label>${rolSelect(u.rol)}</div>
        <label class="check-row"><input type="checkbox" id="u-activo"${u.activo ? " checked" : ""}> Cuenta activa (puede iniciar sesión)</label>
        <div class="field" style="margin-top:1rem"><label class="label" for="u-pass">Nueva contraseña</label>
          <input class="input" id="u-pass" type="password" autocomplete="new-password" placeholder="Déjalo vacío para no cambiarla"></div>`,
      onSubmit: async (ov) => {
        const nombre = ov.querySelector("#u-nombre").value.trim()
        const password = ov.querySelector("#u-pass").value
        if (!nombre) return "El nombre es requerido"
        if (password && password.length < 8) return "La contraseña debe tener al menos 8 caracteres"
        const body = { nombre, rol: ov.querySelector("#u-rol").value, activo: ov.querySelector("#u-activo").checked }
        if (password) body.password = password
        const { ok, data } = await api(`api/usuarios.php?id=${u.id_usuario}`, { method: "PUT", body })
        if (!ok) return data.error || "No se pudo guardar"
        toast("Usuario actualizado")
        cargar()
        return null
      },
    })
  }

  $("#btn-new").addEventListener("click", nuevo)
  $("#table-wrap").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit]")
    if (ed) editar(usuarios.find((u) => u.id_usuario === Number(ed.dataset.edit)))
  })
  cargar()
})()
