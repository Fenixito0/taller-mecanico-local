import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { NextResponse } from "next/server"

export async function GET(_, { params }) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { id: rawId } = await params
    const idOrden = Number(rawId)
    const venta = await prisma.venta.findUnique({
      where: { id_orden: idOrden },
      include: {
        orden: {
          include: {
            cliente: true,
            vehiculo: true,
            detalles: { include: { refaccion: true } },
          },
        },
        cliente: true,
      },
    })
    if (!venta)
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    return NextResponse.json({
      id_venta:     venta.id_venta,
      id_orden:     venta.id_orden,
      fecha_venta:  venta.fecha_venta,
      subtotal:     Number(venta.subtotal),
      mano_obra:    Number(venta.mano_obra),
      iva:          Number(venta.iva),
      precio_total: Number(venta.precio_total),
      metodo_pago:  venta.metodo_pago,
      estado_pago:  venta.estado_pago,
      cliente: {
        rfc:              venta.cliente.rfc,
        nombre:           venta.cliente.nombre,
        apellido_paterno: venta.cliente.apellido_paterno,
        apellido_materno: venta.cliente.apellido_materno,
        telefono:         venta.cliente.telefono,
        correo:           venta.cliente.correo,
      },
      vehiculo: {
        marca:  venta.orden.vehiculo.marca,
        modelo: venta.orden.vehiculo.modelo,
        anio:   venta.orden.vehiculo.anio,
        color:  venta.orden.vehiculo.color,
        placas: venta.orden.vehiculo.placas,
      },
      refacciones: venta.orden.detalles.map(d => ({
        id_refaccion:    d.id_refaccion,
        nombre:          d.refaccion.nombre,
        lado:            d.refaccion.lado,
        cantidad:        d.cantidad,
        precio_unitario: Number(d.precio_unitario),
      })),
    })
  } catch {
    return NextResponse.json({ error: "Error al obtener venta" }, { status: 500 })
  }
}
