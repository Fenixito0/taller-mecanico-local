import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { registrarAuditoria } from "@/lib/auditoria"
import { NextResponse } from "next/server"
 
export async function PUT(req, { params }) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { rfc } = await params
    const body = await req.json()
    const { nombre, apellido_paterno, apellido_materno, telefono, correo } = body
    const cliente = await prisma.cliente.update({
      where: { rfc },
      data: { nombre, apellido_paterno, apellido_materno, telefono, correo },
    })
    await registrarAuditoria(`Editó cliente: ${nombre} ${apellido_paterno} (${rfc})`, "clientes")
    return NextResponse.json(cliente)
  } catch {
    return NextResponse.json({ error: "Error al actualizar cliente" }, { status: 500 })
  }
}
 
export async function DELETE(_, { params }) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { rfc } = await params
    await prisma.cliente.delete({ where: { rfc } })
    await registrarAuditoria(`Eliminó cliente con RFC: ${rfc}`, "clientes")
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error al eliminar cliente" }, { status: 500 })
  }
}
