import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { registrarAuditoria } from "@/lib/auditoria"
import { NextResponse } from "next/server"
 
export async function GET() {
  const check = await requireAuth()
  if (check) return check
  try {
    const clientes = await prisma.cliente.findMany({ orderBy: { fecha_registro: "desc" } })
    return NextResponse.json(clientes)
  } catch {
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 })
  }
}
 
export async function POST(req) {
  const check = await requireAuth()
  if (check) return check
  try {
    const body = await req.json()
    const { rfc, nombre, apellido_paterno, apellido_materno, telefono, correo } = body
    if (!rfc || !nombre || !apellido_paterno)
      return NextResponse.json({ error: "RFC, nombre y apellido paterno son requeridos" }, { status: 400 })
    const existe = await prisma.cliente.findUnique({ where: { rfc } })
    if (existe)
      return NextResponse.json({ error: "Ya existe un cliente con ese RFC" }, { status: 409 })
    const cliente = await prisma.cliente.create({
      data: { rfc, nombre, apellido_paterno, apellido_materno, telefono, correo },
    })
    await registrarAuditoria(`Creó cliente: ${nombre} ${apellido_paterno} (${rfc})`, "clientes")
    return NextResponse.json(cliente, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear cliente" }, { status: 500 })
  }
}
