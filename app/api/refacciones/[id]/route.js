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
    const { nombre, descripcion, lado, precio_unitario } = body
    const refaccion = await prisma.refaccion.update({
      where: { id_refaccion: id },
      data: { nombre, descripcion, lado, precio_unitario: parseFloat(precio_unitario) },
    })
    return NextResponse.json(refaccion)
  } catch {
    return NextResponse.json({ error: "Error al actualizar refacción" }, { status: 500 })
  }
}
 
export async function DELETE(_, { params }) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { id: rawId } = await params
    const id = Number(rawId)
    await prisma.refaccion.delete({ where: { id_refaccion: id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error al eliminar refacción" }, { status: 500 })
  }
}
