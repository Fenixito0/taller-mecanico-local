import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { NextResponse } from "next/server"
 
export async function PUT(req, { params }) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { id: rawId } = await params
    const id = Number(rawId)
    const body = await req.json()
    const { marca, modelo, anio, color, rfc_cliente } = body
    const vehiculo = await prisma.$transaction(async (tx) => {
      const v = await tx.vehiculo.update({ where: { id_vehiculo: id }, data: { marca, modelo, anio: Number(anio), color } })
      if (rfc_cliente) {
        await tx.vehiculoCliente.deleteMany({ where: { id_vehiculo: id } })
        await tx.vehiculoCliente.create({ data: { id_vehiculo: id, rfc_cliente } })
      }
      return v
    })
    return NextResponse.json(vehiculo)
  } catch {
    return NextResponse.json({ error: "Error al actualizar vehículo" }, { status: 500 })
  }
}
 
export async function DELETE(_, { params }) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { id: rawId } = await params
    const id = Number(rawId)
    await prisma.$transaction(async (tx) => {
      await tx.vehiculoCliente.deleteMany({ where: { id_vehiculo: id } })
      await tx.vehiculo.delete({ where: { id_vehiculo: id } })
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error al eliminar vehículo" }, { status: 500 })
  }
}
