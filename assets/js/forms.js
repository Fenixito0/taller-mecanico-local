/* Formularios reutilizables (crear / editar) de clientes y vehículos.
   Se usan en sus módulos y también dentro de "Generar Orden" para registrar al vuelo. */
"use strict"

const Forms = (() => {
  const COLORES = ["Blanco", "Negro", "Gris", "Plata", "Rojo", "Azul", "Verde", "Amarillo", "Café", "Naranja", "Otro"]
  const LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{0,50}$/

  /** Crea el esqueleto del modal y devuelve sus partes. */
  function crearModal({ title, sub, body, maxWidth = 520, saveText }) {
    const ov = document.createElement("div")
    ov.className = "overlay"
    ov.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" style="max-width:${maxWidth}px">
        <div class="modal-head">
          <div><h3>${title}</h3><p>${sub}</p></div>
          <button type="button" class="modal-close" data-close aria-label="Cerrar">${ICON.close}</button>
        </div>
        <div class="red-line"></div>
        <div class="modal-body">
          <div class="alert" data-api-err hidden></div>
          ${body}
        </div>
        <div class="modal-foot">
          <span class="kbd-hint">Enter para guardar · Esc para cerrar</span>
          <button type="button" class="btn btn-outline" data-close>CANCELAR</button>
          <button type="button" class="btn btn-primary" data-save style="box-shadow:none;padding:0.75rem 1.75rem;font-size:0.82rem">${saveText}</button>
        </div>
      </div>`
    const close = () => ov.remove()
    ov._close = close
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) close() })
    ov.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close))
    const saveBtn = ov.querySelector("[data-save]")
    // Enter en cualquier campo (excepto textarea) guarda
    ov.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "BUTTON") {
        e.preventDefault()
        saveBtn.click()
      }
    })
    document.body.appendChild(ov)
    return { ov, close, saveBtn, apiErr: ov.querySelector("[data-api-err]") }
  }

  /** Marca/limpia el error de un campo. */
  function setError(ov, k, msg) {
    const w = ov.querySelector(`[data-field="${k}"]`)
    if (!w) return
    const p = w.querySelector("[data-err]")
    p.innerHTML = msg ? `${ICON.alert}${esc(msg)}` : ""
    p.hidden = !msg
    const hint = w.querySelector("[data-hint]")
    if (hint) hint.hidden = !!msg
    w.querySelector(".input")?.classList.toggle("err", !!msg)
  }

  /** Envía a la API con estado de carga; devuelve los datos guardados o null. */
  async function enviar({ saveBtn, apiErr }, url, method, body, saveText) {
    saveBtn.disabled = true
    saveBtn.textContent = "GUARDANDO..."
    apiErr.hidden = true
    try {
      const { ok, data } = await api(url, { method, body })
      if (ok) return data
      apiErr.textContent = data.error || "Error al guardar"
    } catch {
      apiErr.textContent = "Error de conexión"
    }
    apiErr.hidden = false
    saveBtn.disabled = false
    saveBtn.textContent = saveText
    return null
  }

  function enfocarPrimerError(ov) {
    ov.querySelector(".input.err")?.focus()
  }

  // ── Cliente ──────────────────────────────────────────────────────────
  const VALID_CLIENTE = {
    rfc: (v) => /^[A-Z0-9Ñ&]{0,13}$/.test(v),
    nombre: (v) => LETRAS.test(v),
    apellido_paterno: (v) => LETRAS.test(v),
    apellido_materno: (v) => LETRAS.test(v),
    telefono: (v) => /^\d{0,10}$/.test(v),
    correo: () => true,
  }

  function campo(key, label, { required = false, hint = "", attrs = "", full = false, cls = "" } = {}) {
    return `
      <div class="field${full ? " span-all" : ""}" data-field="${key}">
        <label class="label" for="f-${key}">${label} ${required ? '<span class="req">*</span>' : ""}</label>
        <input class="input ${cls}" id="f-${key}" name="${key}" autocomplete="off" ${attrs}>
        <p class="hint" data-hint>${hint}</p>
        <p class="ferr" data-err hidden></p>
      </div>`
  }

  /**
   * @param {{cliente?:object|null, existentes?:object[], onSaved:(c:object)=>void}} opts
   */
  function cliente({ cliente: actual = null, existentes = [], onSaved }) {
    const isEdit = !!actual
    const saveText = isEdit ? "ACTUALIZAR" : "GUARDAR"
    const form = { rfc: "", nombre: "", apellido_paterno: "", apellido_materno: "", telefono: "", correo: "", ...(actual || {}) }
    Object.keys(form).forEach((k) => { if (form[k] === null) form[k] = "" })

    const m = crearModal({
      title: isEdit ? "EDITAR CLIENTE" : "NUEVO CLIENTE",
      sub: isEdit ? `RFC: ${esc(actual.rfc)}` : "Complete los datos del cliente",
      saveText,
      body: `<div class="grid-2">
        ${campo("rfc", "RFC", { required: true, full: true, cls: "rfc", attrs: `maxlength="13" placeholder="XXXX000000XX0" ${isEdit ? "disabled" : ""}` })}
        ${campo("nombre", "Nombre(s)", { required: true, attrs: 'maxlength="50" placeholder="Nombre(s)"' })}
        ${campo("apellido_paterno", "Apellido Paterno", { required: true, attrs: 'maxlength="50" placeholder="Apellido paterno"' })}
        ${campo("apellido_materno", "Apellido Materno", { attrs: 'maxlength="50" placeholder="Apellido materno"' })}
        ${campo("telefono", "Teléfono", { attrs: 'maxlength="10" inputmode="numeric" placeholder="6691234567"' })}
        ${campo("correo", "Correo", { full: true, attrs: 'type="email" maxlength="100" placeholder="correo@ejemplo.com"' })}
      </div>`,
    })
    const { ov } = m
    const input = (k) => ov.querySelector(`[name="${k}"]`)

    function hint(k) {
      const v = form[k]
      const h = ov.querySelector(`[data-field="${k}"] [data-hint]`)
      h.className = "hint"
      if (k === "rfc") h.textContent = v ? `${v.length}/13 caracteres` : "Formato: XXXX000000XX0 (12-13 caracteres)"
      else if (["nombre", "apellido_paterno", "apellido_materno"].includes(k)) {
        h.textContent = `${v.length}/50`
        if (v.length >= 45) h.classList.add("warn")
      } else if (k === "telefono") {
        h.textContent = v ? `${v.length}/10` : "10 dígitos"
        if (v.length === 10) h.classList.add("ok")
      } else h.textContent = ""
    }

    Object.keys(VALID_CLIENTE).forEach((k) => {
      const el = input(k)
      el.value = form[k]
      hint(k)
      el.addEventListener("input", () => {
        const v = k === "rfc" ? el.value.toUpperCase() : el.value
        if (VALID_CLIENTE[k](v)) {
          form[k] = v
          setError(ov, k, null)
        }
        el.value = form[k]
        hint(k)
      })
    })

    m.saveBtn.onclick = async () => {
      const errs = {}
      if (!form.rfc || form.rfc.length < 12) errs.rfc = "RFC debe tener entre 12 y 13 caracteres"
      else if (!isEdit && existentes.some((c) => c.rfc === form.rfc)) errs.rfc = "Este RFC ya está registrado"
      if (!form.nombre.trim()) errs.nombre = "El nombre es requerido"
      if (!form.apellido_paterno.trim()) errs.apellido_paterno = "El apellido paterno es requerido"
      if (form.telefono && form.telefono.length !== 10) errs.telefono = "El teléfono debe tener 10 dígitos"
      if (form.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) errs.correo = "Correo inválido"
      Object.keys(VALID_CLIENTE).forEach((k) => setError(ov, k, errs[k]))
      if (Object.keys(errs).length > 0) return enfocarPrimerError(ov)

      const url = isEdit ? `api/clientes.php?rfc=${encodeURIComponent(form.rfc)}` : "api/clientes.php"
      const data = await enviar(m, url, isEdit ? "PUT" : "POST", form, saveText)
      if (!data) return
      m.close()
      toast(isEdit ? "Cliente actualizado" : `Cliente ${data.nombre} registrado`)
      onSaved(data)
    }

    input(isEdit ? "nombre" : "rfc").focus()
  }

  // ── Vehículo ─────────────────────────────────────────────────────────
  /**
   * @param {{vehiculo?:object|null, clientes?:object[], rfcFijo?:string|null, onSaved:(v:object)=>void}} opts
   *   rfcFijo: si se indica, el propietario queda fijo (uso desde Generar Orden).
   */
  function vehiculo({ vehiculo: actual = null, clientes = [], rfcFijo = null, onSaved }) {
    const isEdit = !!actual
    const saveText = isEdit ? "ACTUALIZAR" : "GUARDAR"
    const anioMax = new Date().getFullYear() + 1
    const form = isEdit
      ? { marca: actual.marca || "", modelo: actual.modelo, anio: actual.anio, color: actual.color || "", placas: actual.placas, rfc_cliente: actual.rfc_cliente || "" }
      : { marca: "", modelo: "", anio: new Date().getFullYear(), color: "", placas: "", rfc_cliente: rfcFijo || "" }

    const fijo = rfcFijo ? clientes.find((c) => c.rfc === rfcFijo) : null
    const selectorCliente = fijo
      ? `<div class="field"><label class="label">Cliente propietario</label>
           <div class="input" style="background:#F9FAFB;font-weight:600;color:var(--navy)">${esc(fijo.nombre)} ${esc(fijo.apellido_paterno)} <span class="mono muted" style="font-weight:400">(${esc(fijo.rfc)})</span></div></div>`
      : `<div class="field" data-field="rfc_cliente">
           <label class="label" for="f-rfc_cliente">Cliente propietario <span class="req">*</span></label>
           <select class="input" id="f-rfc_cliente" name="rfc_cliente">
             <option value="">— Seleccione un cliente —</option>
             ${clientes.map((c) => `<option value="${esc(c.rfc)}">${esc(c.nombre)} ${esc(c.apellido_paterno)} (${esc(c.rfc)})</option>`).join("")}
           </select>
           <p class="ferr" data-err hidden></p>
         </div>`

    const m = crearModal({
      title: isEdit ? "EDITAR VEHÍCULO" : "NUEVO VEHÍCULO",
      sub: isEdit ? `Placas: ${esc(actual.placas)}` : "Complete los datos del vehículo",
      maxWidth: 580,
      saveText,
      body: `${selectorCliente}
        <div class="grid-2">
          <div class="field" data-field="placas"><label class="label" for="f-placas">Placas <span class="req">*</span></label>
            <input class="input mono" id="f-placas" name="placas" maxlength="10" placeholder="ABC1234" autocomplete="off" ${isEdit ? "disabled" : ""}><p class="ferr" data-err hidden></p></div>
          <div class="field"><label class="label" for="f-marca">Marca</label>
            <input class="input" id="f-marca" name="marca" maxlength="60" placeholder="Toyota, Nissan…" list="dl-marcas" autocomplete="off">
            <datalist id="dl-marcas">${["Chevrolet", "Ford", "Honda", "Hyundai", "Kia", "Mazda", "Mitsubishi", "Nissan", "Toyota", "Volkswagen"].map((x) => `<option value="${x}">`).join("")}</datalist></div>
          <div class="field" data-field="modelo"><label class="label" for="f-modelo">Modelo <span class="req">*</span></label>
            <input class="input" id="f-modelo" name="modelo" maxlength="100" placeholder="Corolla, Sentra…" autocomplete="off"><p class="ferr" data-err hidden></p></div>
          <div class="field" data-field="anio"><label class="label" for="f-anio">Año <span class="req">*</span></label>
            <input class="input" id="f-anio" name="anio" type="number" min="1950" max="${anioMax}"><p class="ferr" data-err hidden></p></div>
          <div class="field span-all"><label class="label" for="f-color">Color</label>
            <select class="input" id="f-color" name="color"><option value="">— Seleccione —</option>
            ${COLORES.map((c) => `<option value="${c}">${c}</option>`).join("")}</select></div>
        </div>`,
    })
    const { ov } = m
    const campos = ["marca", "modelo", "anio", "color", "placas", ...(fijo ? [] : ["rfc_cliente"])]
    campos.forEach((k) => {
      const el = ov.querySelector(`[name="${k}"]`)
      el.value = form[k] ?? ""
      el.addEventListener("input", () => {
        form[k] = k === "placas" ? el.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") : el.value
        if (k === "placas") el.value = form[k]
        setError(ov, k, null)
      })
    })

    m.saveBtn.onclick = async () => {
      const errs = {}
      if (!form.modelo.trim()) errs.modelo = "El modelo es requerido"
      const anio = Number(form.anio)
      if (!form.anio) errs.anio = "El año es requerido"
      else if (anio < 1950 || anio > anioMax) errs.anio = `El año debe estar entre 1950 y ${anioMax}`
      if (!form.placas) errs.placas = "Las placas son requeridas"
      if (!form.rfc_cliente) errs.rfc_cliente = "Selecciona un cliente"
      ;["modelo", "anio", "placas", "rfc_cliente"].forEach((k) => setError(ov, k, errs[k]))
      if (Object.keys(errs).length > 0) return enfocarPrimerError(ov)

      const url = isEdit ? `api/vehiculos.php?id=${actual.id_vehiculo}` : "api/vehiculos.php"
      const data = await enviar(m, url, isEdit ? "PUT" : "POST", { ...form, anio }, saveText)
      if (!data) return
      m.close()
      toast(isEdit ? "Vehículo actualizado" : `Vehículo ${data.placas} registrado`)
      onSaved({ ...data, rfc_cliente: form.rfc_cliente })
    }

    ov.querySelector(isEdit ? '[name="modelo"]' : fijo ? '[name="placas"]' : '[name="rfc_cliente"]').focus()
  }

  return { cliente, vehiculo, COLORES }
})()
