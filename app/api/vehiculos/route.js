import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { registrarAuditoria } from "@/lib/auditoria"
import { NextResponse } from "next/server"
 
export async function GET(req) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { searchParams } = new URL(req.url)
    const rfc = searchParams.get("rfc")
    const vehiculos = await prisma.vehiculo.findMany({
      where: rfc ? { clientes: { some: { rfc_cliente: rfc } } } : undefined,
      include: { clientes: { include: { cliente: true } } },
      orderBy: { id_vehiculo: "desc" },
    })
    const result = vehiculos.map(v => ({
      id_vehiculo: v.id_vehiculo,
      marca:       v.marca,
      modelo:      v.modelo,
      anio:        v.anio,
      color:       v.color,
      placas:      v.placas,
      rfc_cliente: v.clientes[0]?.rfc_cliente || null,
      cliente:     v.clientes[0]?.cliente
        ? `${v.clientes[0].cliente.nombre} ${v.clientes[0].cliente.apellido_paterno} ${v.clientes[0].cliente.apellido_materno || ""}`.trim()
        : null,
    }))
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Error al obtener vehículos" }, { status: 500 })
  }
}
 
export async function POST(req) {
  const check = await requireAuth()
  if (check) return check
  try {
    const body = await req.json()
    const { marca, modelo, anio, color, placas, rfc_cliente } = body
    if (!modelo || !anio || !placas || !rfc_cliente)
      return NextResponse.json({ error: "Modelo, año, placas y cliente son requeridos" }, { status: 400 })
    const existe = await prisma.vehiculo.findUnique({ where: { placas } })
    if (existe)
      return NextResponse.json({ error: "Ya existe un vehículo con esas placas" }, { status: 409 })
    const vehiculo = await prisma.$transaction(async (tx) => {
      const v = await tx.vehiculo.create({ data: { marca, modelo, anio: Number(anio), color, placas } })
      await tx.vehiculoCliente.create({ data: { id_vehiculo: v.id_vehiculo, rfc_cliente } })
      return v
    })
    await registrarAuditoria(`Registró vehículo: ${marca} ${modelo} (${placas})`, "vehiculos")
    return NextResponse.json(vehiculo, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear vehículo" }, { status: 500 })
  }
}
