import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { NextResponse } from "next/server"
 
export async function GET() {
  const check = await requireAuth()
  if (check) return check
  try {
    const refacciones = await prisma.refaccion.findMany({ orderBy: { nombre: "asc" } })
    return NextResponse.json(refacciones)
  } catch {
    return NextResponse.json({ error: "Error al obtener refacciones" }, { status: 500 })
  }
}
 
export async function POST(req) {
  const check = await requireAuth()
  if (check) return check
  try {
    const body = await req.json()
    const { nombre, descripcion, lado, precio_unitario } = body
    if (!nombre || precio_unitario === undefined)
      return NextResponse.json({ error: "Nombre y precio son requeridos" }, { status: 400 })
    const refaccion = await prisma.refaccion.create({
      data: { nombre, descripcion, lado: lado || "NA", precio_unitario: parseFloat(precio_unitario) },
    })
    return NextResponse.json(refaccion, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear refacción" }, { status: 500 })
  }
}
