import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { NextResponse } from "next/server"
 
export async function GET(_, { params }) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { id: rawId } = await params
    const id = Number(rawId)
    const orden = await prisma.ordenServicio.findUnique({
      where: { id_orden: id },
      include: { cliente: true, vehiculo: true, detalles: { include: { refaccion: true } }, venta: true },
    })
    if (!orden)
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 })
    return NextResponse.json({
      id_orden:       orden.id_orden,
      estado:         orden.estado,
      fecha_creacion: orden.fecha_creacion,
      observaciones:  orden.observaciones,
      cliente: {
        rfc:              orden.cliente.rfc,
        nombre:           orden.cliente.nombre,
        apellido_paterno: orden.cliente.apellido_paterno,
        apellido_materno: orden.cliente.apellido_materno,
        telefono:         orden.cliente.telefono,
        correo:           orden.cliente.correo,
      },
      vehiculo: {
        marca:  orden.vehiculo.marca,
        modelo: orden.vehiculo.modelo,
        anio:   orden.vehiculo.anio,
        color:  orden.vehiculo.color,
        placas: orden.vehiculo.placas,
      },
      refacciones: orden.detalles.map(d => ({
        id_refaccion:    d.id_refaccion,
        nombre:          d.refaccion.nombre,
        lado:            d.refaccion.lado,
        cantidad:        d.cantidad,
        precio_unitario: Number(d.precio_unitario),
      })),
    })
  } catch {
    return NextResponse.json({ error: "Error al obtener orden" }, { status: 500 })
  }
}
