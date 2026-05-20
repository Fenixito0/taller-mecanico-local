import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"

const NAVY = "0F1F3D"
const RED = "C8102E"
const WHITE = "FFFFFF"
const GRAY = "F9FAFB"
const GREEN = "15803D"
const METODO = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" }

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

    const ventas = await prisma.venta.findMany({
      where: { fecha_venta: { gte: desde, lte: hasta }, estado_pago: "pagado" },
      include: { orden: { include: { cliente: true, vehiculo: true, detalles: { include: { refaccion: true } } } }, cliente: true },
      orderBy: { fecha_venta: "desc" },
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = "Taller Mecánico"

    // Sheet 1: Ventas
    const ws = wb.addWorksheet("Reporte Ingresos", { pageSetup: { paperSize: 1, orientation: "landscape" } })
    ws.columns = [
      { width: 10 }, { width: 10 }, { width: 18 }, { width: 26 }, { width: 22 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 },
    ]

    ws.mergeCells("A1:J1")
    const t = ws.getCell("A1")
    t.value = "TALLER MECÁNICO — REPORTE DE INGRESOS"
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
    const p = ws.getCell("A3")
    p.value = `Periodo: ${desdeStr} — ${hastaStr}`
    p.font = { name: "Arial", size: 11, bold: true, color: { argb: NAVY } }
    p.alignment = { horizontal: "center", vertical: "middle" }
    ws.getRow(3).height = 28

    const totalIng = ventas.reduce((s, v) => s + Number(v.precio_total), 0)
    const promedio = ventas.length > 0 ? totalIng / ventas.length : 0
    ws.mergeCells("A4:J4")
    const res = ws.getCell("A4")
    res.value = `Ventas: ${ventas.length}  |  Ingresos: $${totalIng.toFixed(2)}  |  Ticket promedio: $${promedio.toFixed(2)}`
    res.font = { name: "Arial", size: 10, bold: true, color: { argb: GREEN } }
    res.alignment = { horizontal: "center", vertical: "middle" }
    ws.getRow(4).height = 24

    const headers = ["Folio", "Orden", "Fecha", "Cliente", "Vehículo", "Método", "Subtotal", "M. Obra", "IVA", "Total"]
    const hr = ws.getRow(6)
    headers.forEach((h, i) => {
      const c = hr.getCell(i + 1)
      c.value = h
      c.font = { name: "Arial", size: 9, bold: true, color: { argb: WHITE } }
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
      c.alignment = { horizontal: i >= 6 ? "right" : "left", vertical: "middle" }
    })
    hr.height = 24

    ventas.forEach((v, idx) => {
      const r = ws.getRow(7 + idx)
      const vals = [
        `V-${String(v.id_venta).padStart(4, "0")}`,
        `#${String(v.id_orden).padStart(4, "0")}`,
        new Date(v.fecha_venta).toLocaleDateString("es-MX"),
        `${v.cliente.nombre} ${v.cliente.apellido_paterno}`,
        `${v.orden.vehiculo.marca || ""} ${v.orden.vehiculo.modelo}`.trim(),
        METODO[v.metodo_pago],
        Number(v.subtotal), Number(v.mano_obra), Number(v.iva), Number(v.precio_total),
      ]
      vals.forEach((val, i) => {
        const c = r.getCell(i + 1)
        c.value = val
        c.font = { name: "Arial", size: 10 }
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? WHITE : GRAY } }
        if (i >= 6) { c.alignment = { horizontal: "right" }; c.numFmt = '$#,##0.00' }
      })
    })

    let totRow = 7 + ventas.length
    ws.mergeCells(`A${totRow}:E${totRow}`)
    const totLabel = ws.getCell(`A${totRow}`)
    totLabel.value = "TOTALES"
    totLabel.font = { name: "Arial", size: 11, bold: true, color: { argb: WHITE } }
    totLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
    totLabel.alignment = { horizontal: "right", vertical: "middle" }
    ;["F"].forEach(col => {
      const c = ws.getCell(`${col}${totRow}`)
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
    })
    const totFields = [
      ventas.reduce((s, v) => s + Number(v.subtotal), 0),
      ventas.reduce((s, v) => s + Number(v.mano_obra), 0),
      ventas.reduce((s, v) => s + Number(v.iva), 0),
      totalIng,
    ]
    totFields.forEach((val, i) => {
      const c = ws.getCell(`${["G","H","I","J"][i]}${totRow}`)
      c.value = val
      c.numFmt = '$#,##0.00'
      c.font = { name: "Arial", size: 11, bold: true, color: { argb: WHITE } }
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
      c.alignment = { horizontal: "right", vertical: "middle" }
    })
    ws.getRow(totRow).height = 28

    // Sheet 2: Top Refacciones
    const ws2 = wb.addWorksheet("Top Refacciones")
    ws2.columns = [{ width: 6 }, { width: 36 }, { width: 14 }, { width: 18 }]
    ws2.mergeCells("A1:D1")
    const t2 = ws2.getCell("A1")
    t2.value = "REFACCIONES MÁS VENDIDAS"
    t2.font = { name: "Arial", size: 12, bold: true, color: { argb: WHITE } }
    t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
    t2.alignment = { horizontal: "center", vertical: "middle" }
    ws2.getRow(1).height = 30

    const rh = ws2.getRow(2)
    ;["#", "Refacción", "Cantidad", "Ingreso"].forEach((h, i) => {
      const c = rh.getCell(i + 1)
      c.value = h
      c.font = { name: "Arial", size: 9, bold: true, color: { argb: NAVY } }
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E8EDF5" } }
      c.alignment = { horizontal: i >= 2 ? "right" : "left" }
    })

    const refMap = {}
    ventas.forEach(v => {
      v.orden.detalles.forEach(d => {
        const k = d.id_refaccion
        if (!refMap[k]) refMap[k] = { nombre: d.refaccion.nombre, cantidad: 0, ingreso: 0 }
        refMap[k].cantidad += d.cantidad
        refMap[k].ingreso += Number(d.precio_unitario) * d.cantidad
      })
    })
    Object.values(refMap).sort((a, b) => b.cantidad - a.cantidad).forEach((ref, i) => {
      const r = ws2.getRow(3 + i)
      ;[i + 1, ref.nombre, ref.cantidad, ref.ingreso].forEach((v, ci) => {
        const c = r.getCell(ci + 1)
        c.value = v
        c.font = { name: "Arial", size: 10 }
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? WHITE : GRAY } }
        if (ci >= 2) c.alignment = { horizontal: "right" }
        if (ci === 3) c.numFmt = '$#,##0.00'
      })
    })

    const buffer = await wb.xlsx.writeBuffer()
    const fname = `Reporte_Ingresos_${desde.toISOString().split("T")[0]}_${hasta.toISOString().split("T")[0]}.xlsx`
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
