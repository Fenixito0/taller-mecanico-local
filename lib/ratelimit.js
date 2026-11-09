// Rate limiter en memoria (ventana deslizante) para el login.
// Reemplaza a Upstash Redis: suficiente para un servidor local de una sola instancia.
// Los contadores se reinician al reiniciar el servidor.

const MAX_INTENTOS = 5
const VENTANA_MS = 15 * 60 * 1000

const globalForRL = globalThis
const intentos = globalForRL.__loginRateLimit ?? new Map()
if (process.env.NODE_ENV !== "production") globalForRL.__loginRateLimit = intentos

export const ratelimit = {
  async limit(key) {
    const ahora = Date.now()
    const recientes = (intentos.get(key) ?? []).filter((t) => ahora - t < VENTANA_MS)

    if (recientes.length >= MAX_INTENTOS) {
      intentos.set(key, recientes)
      return { success: false, reset: recientes[0] + VENTANA_MS }
    }

    intentos.set(key, [...recientes, ahora])
    return { success: true, reset: ahora + VENTANA_MS }
  },
}
