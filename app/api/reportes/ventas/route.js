import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { NextResponse } from "next/server"

export async function GET(req) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { searchParams } = new URL(req.url)
    const ahora = new Date()
    const lunes = new Date(ahora)
    lunes.setDate(ahora.getDate() - ((ahora.getDay() + 6) % 7))
    lunes.setHours(0, 0, 0, 0)
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    domingo.setHours(23, 59, 59, 999)

    const desde = searchParams.get("desde") ? new Date(searchParams.get("desde") + "T00:00:00") : lunes
    const hasta = searchParams.get("hasta") ? new Date(searchParams.get("hasta") + "T23:59:59.999") : domingo

    const ventas = await prisma.venta.findMany({
      where: { fecha_venta: { gte: desde, lte: hasta }, estado_pago: "pagado" },
      include: {
        orden: { include: { cliente: true, vehiculo: true, detalles: { include: { refaccion: true } } } },
        cliente: true,
      },
      orderBy: { fecha_venta: "desc" },
    })

    const totalIngresos = ventas.reduce((s, v) => s + Number(v.precio_total), 0)
    const totalManoObra = ventas.reduce((s, v) => s + Number(v.mano_obra), 0)
    const totalIva = ventas.reduce((s, v) => s + Number(v.iva), 0)
    const promedio = ventas.length > 0 ? totalIngresos / ventas.length : 0

    const porMetodo = { efectivo: 0, tarjeta: 0, transferencia: 0 }
    const conteoMetodo = { efectivo: 0, tarjeta: 0, transferencia: 0 }
    ventas.forEach(v => {
      porMetodo[v.metodo_pago] += Number(v.precio_total)
      conteoMetodo[v.metodo_pago]++
    })

    const refMap = {}
    ventas.forEach(v => {
      v.orden.detalles.forEach(d => {
        const key = d.id_refaccion
        if (!refMap[key]) refMap[key] = { nombre: d.refaccion.nombre, cantidad: 0, ingreso: 0 }
        refMap[key].cantidad += d.cantidad
        refMap[key].ingreso += Number(d.precio_unitario) * d.cantidad
      })
    })
    const topRefacciones = Object.values(refMap).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10)

    const lista = ventas.map(v => ({
      id_venta: v.id_venta,
      id_orden: v.id_orden,
      fecha: v.fecha_venta,
      cliente: `${v.cliente.nombre} ${v.cliente.apellido_paterno}`,
      vehiculo: `${v.orden.vehiculo.marca || ""} ${v.orden.vehiculo.modelo}`.trim(),
      metodo_pago: v.metodo_pago,
      subtotal: Number(v.subtotal),
      mano_obra: Number(v.mano_obra),
      iva: Number(v.iva),
      total: Number(v.precio_total),
    }))

    return NextResponse.json({
      desde, hasta,
      resumen: {
        total_ventas: ventas.length,
        total_ingresos: totalIngresos,
        total_mano_obra: totalManoObra,
        total_iva: totalIva,
        promedio_ticket: promedio,
        por_metodo: porMetodo,
        conteo_metodo: conteoMetodo,
      },
      top_refacciones: topRefacciones,
      ventas: lista,
    })
  } catch {
    return NextResponse.json({ error: "Error al generar reporte" }, { status: 500 })
  }
}
