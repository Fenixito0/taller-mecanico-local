import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { registrarAuditoria } from "@/lib/auditoria"
import { NextResponse } from "next/server"

// PATCH /api/ordenes/[id]/cancelar → cancelar orden
export async function PATCH(_, { params }) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { id: rawId } = await params
    const id = Number(rawId)

    const orden = await prisma.ordenServicio.findUnique({ where: { id_orden: id } })

    if (!orden)
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 })

    if (orden.estado !== "pendiente")
      return NextResponse.json({ error: "Solo se pueden cancelar órdenes pendientes" }, { status: 409 })

    await prisma.ordenServicio.update({
      where: { id_orden: id },
      data:  { estado: "cancelado" },
    })

    await registrarAuditoria(`Canceló orden #${id}`, "ordenes")

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error al cancelar la orden" }, { status: 500 })
  }
}