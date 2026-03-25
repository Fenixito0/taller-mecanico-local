import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { registrarAuditoria } from "@/lib/auditoria"
import { NextResponse } from "next/server"
 
export async function GET() {
  const check = await requireAuth()
  if (check) return check
  try {
    const ordenes = await prisma.ordenServicio.findMany({
      orderBy: { fecha_creacion: "desc" },
      include: { cliente: true, vehiculo: true, detalles: { include: { refaccion: true } }, venta: true },
    })
    const result = ordenes.map(o => ({
      id_orden:       o.id_orden,
      fecha_creacion: o.fecha_creacion,
      estado:         o.estado,
      observaciones:  o.observaciones,
      rfc:            o.rfc_cliente,
      cliente:        `${o.cliente.nombre} ${o.cliente.apellido_paterno} ${o.cliente.apellido_materno || ""}`.trim(),
      placas:         o.vehiculo.placas,
      vehiculo:       `${o.vehiculo.marca || ""} ${o.vehiculo.modelo} ${o.vehiculo.anio}`.trim(),
      refacciones:    o.detalles.map(d => ({
        id_refaccion:    d.id_refaccion,
        nombre:          d.refaccion.nombre,
        lado:            d.refaccion.lado,
        cantidad:        d.cantidad,
        precio_unitario: Number(d.precio_unitario),
      })),
    }))
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Error al obtener órdenes" }, { status: 500 })
  }
}
 
export async function POST(req) {
  const check = await requireAuth()
  if (check) return check
  try {
    const body = await req.json()
    const { id_vehiculo, rfc_cliente, id_usuario, observaciones, refacciones } = body
    if (!id_vehiculo || !rfc_cliente || !refacciones?.length)
      return NextResponse.json({ error: "Vehículo, cliente y al menos una refacción son requeridos" }, { status: 400 })
    const orden = await prisma.$transaction(async (tx) => {
      const o = await tx.ordenServicio.create({
        data: { id_vehiculo: Number(id_vehiculo), rfc_cliente, id_usuario: id_usuario ? Number(id_usuario) : null, observaciones: observaciones || null, estado: "pendiente" },
      })
      await tx.detalleOrden.createMany({
        data: refacciones.map(r => ({
          id_orden: o.id_orden, id_refaccion: Number(r.id_refaccion),
          cantidad: Number(r.cantidad), precio_unitario: parseFloat(r.precio_unitario),
        })),
      })
      return o
    })
    await registrarAuditoria(`Generó orden #${orden.id_orden} para cliente RFC: ${rfc_cliente}`, "ordenes")
    return NextResponse.json(orden, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear orden" }, { status: 500 })
  }
}
