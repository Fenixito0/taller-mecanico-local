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

    const ordenes = await prisma.ordenServicio.findMany({
      where: { fecha_creacion: { gte: desde, lte: hasta } },
      include: {
        cliente: true,
        vehiculo: true,
        detalles: { include: { refaccion: true } },
        venta: true,
      },
      orderBy: { fecha_creacion: "desc" },
    })

    const resumen = {
      total: ordenes.length,
      pendientes: ordenes.filter(o => o.estado === "pendiente").length,
      completadas: ordenes.filter(o => o.estado === "completado").length,
      canceladas: ordenes.filter(o => o.estado === "cancelado").length,
    }

    const lista = ordenes.map(o => ({
      id_orden: o.id_orden,
      fecha: o.fecha_creacion,
      estado: o.estado,
      cliente: `${o.cliente.nombre} ${o.cliente.apellido_paterno}`,
      rfc: o.cliente.rfc,
      vehiculo: `${o.vehiculo.marca || ""} ${o.vehiculo.modelo}`.trim(),
      placas: o.vehiculo.placas,
      num_refacciones: o.detalles.length,
      subtotal: o.detalles.reduce((s, d) => s + Number(d.precio_unitario) * d.cantidad, 0),
      total_venta: o.venta ? Number(o.venta.precio_total) : null,
    }))

    return NextResponse.json({ desde, hasta, resumen, ordenes: lista })
  } catch {
    return NextResponse.json({ error: "Error al generar reporte" }, { status: 500 })
  }
}
