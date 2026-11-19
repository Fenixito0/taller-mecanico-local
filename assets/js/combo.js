/* Selector con buscador. El usuario solo puede quedarse con un valor de la lista;
   si lo que busca no existe, puede agregarlo (con confirmación) cuando se permite. */
"use strict"

const Combo = (() => {
  const CHEV = '<svg class="combo-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>'
  const MAX_VISIBLES = 80
  let seq = 0

  /**
   * Monta el selector dentro de `host` (se vacía).
   * @param {HTMLElement} host
   * @param {{
   *   items: string[] | (() => string[]),
   *   value?: string,
   *   id?: string,
   *   placeholder?: string,
   *   big?: boolean,
   *   onChange: (valor: string) => void,
   *   onAdd?: (texto: string) => Promise<string|null>,
   *   addLabel?: string,
   *   guard?: () => string|null,
   *   onGuard?: () => void,
   * }} o
   *   guard: si devuelve un mensaje, en vez de abrir la lista se muestra la advertencia y se llama onGuard.
   */
  function mount(host, o) {
    const listId = `combo-list-${++seq}`
    let valor = o.value || ""
    let abierto = false
    let hl = 0
    let opciones = []
    const lista = () => (typeof o.items === "function" ? o.items() : o.items) || []

    host.classList.add("combo")
    host.innerHTML = `
      <input class="input combo-input${o.big ? " combo-big" : ""}" ${o.id ? `id="${esc(o.id)}"` : ""} type="text" autocomplete="off" spellcheck="false"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${listId}" placeholder="${esc(o.placeholder || "Buscar...")}">
      ${CHEV}
      <div class="combo-list" id="${listId}" role="listbox" hidden></div>`
    const input = host.querySelector("input")
    const box = host.querySelector(".combo-list")
    input.value = valor

    function filtrar(q) {
      const nq = norm(q.trim())
      const todos = lista()
      const coincide = nq ? todos.filter((x) => norm(x).includes(nq)) : todos
      // primero los que empiezan con el texto
      const ordenados = nq ? [...coincide].sort((a, b) => Number(!norm(a).startsWith(nq)) - Number(!norm(b).startsWith(nq))) : coincide
      const exacto = todos.some((x) => norm(x) === nq)
      const opts = ordenados.slice(0, MAX_VISIBLES).map((x) => ({ tipo: "item", valor: x }))
      if (o.onAdd && nq && !exacto) opts.push({ tipo: "add", valor: q.trim() })
      return { opts, total: coincide.length }
    }

    function pintar() {
      const q = input.value === valor ? "" : input.value
      const { opts, total } = filtrar(q)
      opciones = opts
      hl = Math.min(hl, Math.max(0, opts.length - 1))
      if (opts.length === 0) {
        box.innerHTML = `<div class="combo-empty">${q ? `Sin resultados para «${esc(q)}»` : "La lista está vacía"}</div>`
        return
      }
      box.innerHTML = opts.map((op, i) => op.tipo === "add"
        ? `<div class="combo-opt combo-add${i === hl ? " hl" : ""}" role="option" data-i="${i}">+ ${esc(o.addLabel || "Agregar")} «${esc(op.valor)}»</div>`
        : `<div class="combo-opt${i === hl ? " hl" : ""}${op.valor === valor ? " sel" : ""}" role="option" aria-selected="${op.valor === valor}" data-i="${i}">${esc(op.valor)}</div>`).join("")
        + (total > MAX_VISIBLES ? `<div class="combo-empty">Mostrando ${MAX_VISIBLES} de ${total}. Escribe para filtrar.</div>` : "")
      box.querySelector(".hl")?.scrollIntoView({ block: "nearest" })
    }

    function abrir() {
      if (abierto) return
      const aviso = o.guard?.()
      if (aviso) {
        toast(aviso, "error")
        input.blur()
        o.onGuard?.()
        return
      }
      abierto = true
      hl = Math.max(0, lista().indexOf(valor))
      box.hidden = false
      input.setAttribute("aria-expanded", "true")
      host.classList.add("open")
      pintar()
    }

    function cerrar(revertir = true) {
      abierto = false
      box.hidden = true
      input.setAttribute("aria-expanded", "false")
      host.classList.remove("open")
      if (revertir) input.value = valor
    }

    function fijar(v) {
      const cambio = v !== valor
      valor = v
      input.value = v
      cerrar(false)
      if (cambio) o.onChange(v)
    }

    async function elegir(i) {
      const op = opciones[i]
      if (!op) return
      if (op.tipo === "item") return fijar(op.valor)
      cerrar()
      const nuevo = await o.onAdd(op.valor)
      if (nuevo) fijar(nuevo)
      input.focus()
    }

    input.addEventListener("focus", () => { abrir(); input.select() })
    input.addEventListener("click", abrir)
    input.addEventListener("input", () => {
      if (!abierto) abrir()
      if (!abierto) return
      hl = 0
      pintar()
    })
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        if (!abierto) return abrir()
        hl = (hl + (e.key === "ArrowDown" ? 1 : -1) + opciones.length) % Math.max(1, opciones.length)
        return pintar()
      }
      if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
        if (!abierto) return // deja que el formulario use Enter (guardar)
        e.preventDefault()
        e.stopPropagation()
        return elegir(hl)
      }
      if (e.key === "Escape" && abierto) {
        e.stopPropagation()
        cerrar()
      }
      if (e.key === "Tab" && abierto) {
        // Tab acepta solo si hay una coincidencia exacta o única
        const items = opciones.filter((x) => x.tipo === "item")
        const exacta = items.find((x) => norm(x.valor) === norm(input.value.trim()))
        if (exacta) fijar(exacta.valor)
        else if (items.length === 1 && input.value.trim()) fijar(items[0].valor)
        else cerrar()
      }
    })
    input.addEventListener("blur", () => {
      if (!abierto) return
      const exacta = lista().find((x) => norm(x) === norm(input.value.trim()))
      if (exacta) fijar(exacta)
      else cerrar()
    })
    // mousedown (no click) para elegir antes de que el input pierda el foco
    box.addEventListener("mousedown", (e) => {
      e.preventDefault()
      const op = e.target.closest("[data-i]")
      if (op) elegir(Number(op.dataset.i))
    })

    return {
      input,
      get value() { return valor },
      setValue(v) { valor = v || ""; input.value = valor },
      focus() { input.focus() },
      refresh() { if (abierto) pintar() },
    }
  }

  /**
   * Pide confirmación y agrega un elemento al catálogo del servidor.
   * @param {{tipo:"marca"|"modelo"|"pieza", nombre:string, id_marca?:number, etiqueta:string, contexto?:string}} d
   * @returns {Promise<object|null>} lo que devolvió la API, o null si se canceló
   */
  function agregarAlCatalogo(d) {
    return new Promise((resolve) => {
      let resultado = null
      const ov = confirmDialog({
        icon: sym("note", 24, "var(--navy)"),
        title: `¿Agregar ${d.etiqueta}?`,
        detail: `<p class="t">${esc(d.nombre.replace(/\s+/g, " ").trim())}</p>${d.contexto ? `<p class="m">${esc(d.contexto)}</p>` : ""}`,
        note: "Revisa que esté bien escrito: quedará en la lista para todos.",
        okText: "SÍ, AGREGAR",
        busyText: "AGREGANDO...",
        onConfirm: async () => {
          const body = { tipo: d.tipo, nombre: d.nombre, ...(d.id_marca ? { id_marca: d.id_marca } : {}) }
          const { ok, data } = await api("api/catalogo.php", { method: "POST", body })
          if (!ok) return data.error || "No se pudo agregar"
          resultado = data
          toast(`${d.nombre.trim()} agregado a la lista`)
          return null
        },
      })
      const cerrarOriginal = ov._close
      ov._close = () => { cerrarOriginal(); resolve(resultado) }
      new MutationObserver((_, obs) => {
        if (!ov.isConnected) { obs.disconnect(); resolve(resultado) }
      }).observe(document.body, { childList: true })
    })
  }

  return { mount, agregarAlCatalogo }
})()
