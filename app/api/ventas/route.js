import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { registrarAuditoria } from "@/lib/auditoria"
import { NextResponse } from "next/server"
 
export async function POST(req) {
  const check = await requireAuth()
  if (check) return check
  try {
    const body = await req.json()
    const { id_orden, rfc_cliente, subtotal, mano_obra, iva, precio_total, metodo_pago } = body
    if (!id_orden || !rfc_cliente || !precio_total)
      return NextResponse.json({ error: "Datos incompletos para registrar la venta" }, { status: 400 })
    const orden = await prisma.ordenServicio.findUnique({ where: { id_orden: Number(id_orden) } })
    if (!orden)
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 })
    if (orden.estado === "completado" || orden.estado === "cancelado")
      return NextResponse.json({ error: "Esta orden ya no se puede cobrar" }, { status: 409 })
    const venta = await prisma.$transaction(async (tx) => {
      const v = await tx.venta.create({
        data: {
          id_orden: Number(id_orden), rfc_cliente,
          subtotal: parseFloat(subtotal), mano_obra: parseFloat(mano_obra || 0),
          iva: parseFloat(iva || 0), precio_total: parseFloat(precio_total),
          metodo_pago: metodo_pago || "efectivo", estado_pago: "pagado",
        },
      })
      await tx.ordenServicio.update({ where: { id_orden: Number(id_orden) }, data: { estado: "completado" } })
      return v
    })
    await registrarAuditoria(`Cobró venta de orden #${id_orden} por $${precio_total} (${metodo_pago})`, "ventas")
    return NextResponse.json(venta, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al registrar la venta" }, { status: 500 })
  }
}
