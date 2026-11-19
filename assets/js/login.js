"use strict"

;(() => {
  const form = $("#login-form")
  const btn = $("#btn-login")
  const errBox = $("#login-error")
  const pass = $("#password")

  // Página a la que se vuelve tras entrar (solo rutas locales del sistema)
  const next = new URLSearchParams(location.search).get("next") || ""
  const destino = /^[a-z_]+\.php(\?[\w=&%.-]*)?$/.test(next) && next !== "login.php" ? next : "orden_nueva.php"

  // Recordar el último usuario para no escribirlo cada vez
  const ultimo = localStorage.getItem("ultimoUsuario")
  if (ultimo) {
    $("#username").value = ultimo
    pass.focus()
  }

  $("#toggle-pass").addEventListener("click", () => {
    const show = pass.type === "password"
    pass.type = show ? "text" : "password"
    $("[data-show]").hidden = show
    $("[data-hide]").hidden = !show
  })

  const showError = (msg) => {
    errBox.querySelector("span").textContent = msg
    errBox.hidden = false
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    const username = $("#username").value.trim()
    const password = pass.value
    if (!username || !password) {
      showError("Ingrese usuario y contraseña.")
      return
    }
    errBox.hidden = true
    btn.disabled = true
    btn.innerHTML = '<span class="spinner sm"></span>VERIFICANDO...'
    try {
      const { ok, data } = await api("api/auth.php?accion=login", { method: "POST", body: { username, password }, noRedirect: true })
      if (ok) {
        localStorage.setItem("ultimoUsuario", username)
        location.href = destino
        return
      }
      showError(data.error || "Usuario o contraseña incorrectos.")
    } catch {
      showError("Error de conexión con el servidor.")
    }
    btn.disabled = false
    btn.textContent = "INGRESAR AL SISTEMA"
  })
})()
