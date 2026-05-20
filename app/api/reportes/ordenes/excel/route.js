import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"

const NAVY = "0F1F3D"
const RED = "C8102E"
const WHITE = "FFFFFF"
const GRAY = "F9FAFB"
const ESTADO = { pendiente:"Pendiente", completado:"Completado", cancelado:"Cancelado" }

export async function GET(req) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { searchParams } = new URL(req.url)
    const ahora = new Date()
    const lunes = new Date(ahora)
    lunes.setDate(ahora.getDate() - ((ahora.getDay() + 6) % 7))
    lunes.setHours(0, 0, 0, 0)
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    domingo.setHours(23, 59, 59, 999)

    const desde = searchParams.get("desde") ? new Date(searchParams.get("desde") + "T00:00:00") : lunes
    const hasta = searchParams.get("hasta") ? new Date(searchParams.get("hasta") + "T23:59:59.999") : domingo

    const ordenes = await prisma.ordenServicio.findMany({
      where: { fecha_creacion: { gte: desde, lte: hasta } },
      include: { cliente: true, vehiculo: true, detalles: { include: { refaccion: true } }, venta: true },
      orderBy: { fecha_creacion: "desc" },
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = "Taller Mecánico"
    const ws = wb.addWorksheet("Reporte Órdenes", { pageSetup: { paperSize: 1, orientation: "landscape" } })

    ws.columns = [
      { width: 10 }, { width: 18 }, { width: 14 }, { width: 28 }, { width: 16 },
      { width: 22 }, { width: 12 }, { width: 10 }, { width: 16 }, { width: 16 },
    ]

    ws.mergeCells("A1:J1")
    const t = ws.getCell("A1")
    t.value = "TALLER MECÁNICO — REPORTE SEMANAL DE ÓRDENES"
    t.font = { name: "Arial", size: 14, bold: true, color: { argb: WHITE } }
    t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
    t.alignment = { horizontal: "center", vertical: "middle" }
    ws.getRow(1).height = 36

    ws.mergeCells("A2:J2")
    ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED } }
    ws.getRow(2).height = 4

    const desdeStr = desde.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })
    const hastaStr = hasta.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })
    ws.mergeCells("A3:J3")
    const periodo = ws.getCell("A3")
    periodo.value = `Periodo: ${desdeStr} — ${hastaStr}`
    periodo.font = { name: "Arial", size: 11, bold: true, color: { argb: NAVY } }
    periodo.alignment = { horizontal: "center", vertical: "middle" }
    ws.getRow(3).height = 28

    const pend = ordenes.filter(o => o.estado === "pendiente").length
    const comp = ordenes.filter(o => o.estado === "completado").length
    const canc = ordenes.filter(o => o.estado === "cancelado").length
    ws.mergeCells("A4:J4")
    const res = ws.getCell("A4")
    res.value = `Total: ${ordenes.length}  |  Pendientes: ${pend}  |  Completadas: ${comp}  |  Canceladas: ${canc}`
    res.font = { name: "Arial", size: 10 }
    res.alignment = { horizontal: "center", vertical: "middle" }
    ws.getRow(4).height = 24

    const headers = ["# Orden", "Fecha", "Estado", "Cliente", "RFC", "Vehículo", "Placas", "Piezas", "Subtotal", "Total Venta"]
    const hr = ws.getRow(6)
    headers.forEach((h, i) => {
      const c = hr.getCell(i + 1)
      c.value = h
      c.font = { name: "Arial", size: 9, bold: true, color: { argb: WHITE } }
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
      c.alignment = { horizontal: i >= 7 ? "right" : "left", vertical: "middle" }
    })
    hr.height = 24

    ordenes.forEach((o, idx) => {
      const r = ws.getRow(7 + idx)
      const sub = o.detalles.reduce((s, d) => s + Number(d.precio_unitario) * d.cantidad, 0)
      const vals = [
        `#${String(o.id_orden).padStart(4, "0")}`,
        new Date(o.fecha_creacion).toLocaleDateString("es-MX"),
        ESTADO[o.estado],
        `${o.cliente.nombre} ${o.cliente.apellido_paterno}`,
        o.cliente.rfc,
        `${o.vehiculo.marca || ""} ${o.vehiculo.modelo}`.trim(),
        o.vehiculo.placas,
        o.detalles.length,
        sub,
        o.venta ? Number(o.venta.precio_total) : null,
      ]
      vals.forEach((v, i) => {
        const c = r.getCell(i + 1)
        c.value = v
        c.font = { name: "Arial", size: 10 }
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? WHITE : GRAY } }
        if (i >= 7) c.alignment = { horizontal: "right" }
        if (i === 8 || i === 9) c.numFmt = '$#,##0.00'
        if (i === 2) {
          const colors = { Pendiente: "B45309", Completado: "15803D", Cancelado: RED }
          c.font = { name: "Arial", size: 10, bold: true, color: { argb: colors[v] || NAVY } }
        }
      })
    })

    const buffer = await wb.xlsx.writeBuffer()
    const fname = `Reporte_Ordenes_${desde.toISOString().split("T")[0]}_${hasta.toISOString().split("T")[0]}.xlsx`
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=${fname}`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Error al generar Excel" }, { status: 500 })
  }
}
