import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-check"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"

const LADO_LABELS = { izquierdo:"Izquierdo", derecho:"Derecho", central:"Central", "N/A":"N/A" }
const METODO_LABELS = { efectivo:"Efectivo", tarjeta:"Tarjeta", transferencia:"Transferencia" }
const ESTADO_LABELS = { pendiente:"Pendiente", completado:"Completado", cancelado:"Cancelado" }

const NAVY = "0F1F3D"
const RED  = "C8102E"
const GRAY_BG = "F9FAFB"
const WHITE = "FFFFFF"
const BORDER_COLOR = "E5E7EB"

function thinBorder() {
  return {
    top:    { style:"thin", color:{ argb:BORDER_COLOR } },
    left:   { style:"thin", color:{ argb:BORDER_COLOR } },
    bottom: { style:"thin", color:{ argb:BORDER_COLOR } },
    right:  { style:"thin", color:{ argb:BORDER_COLOR } },
  }
}

export async function GET(_, { params }) {
  const check = await requireAuth()
  if (check) return check
  try {
    const { id: rawId } = await params
    const idOrden = Number(rawId)

    const orden = await prisma.ordenServicio.findUnique({
      where: { id_orden: idOrden },
      include: {
        cliente: true,
        vehiculo: true,
        detalles: { include: { refaccion: true } },
        venta: true,
        usuario: true,
      },
    })
    if (!orden)
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 })

    const wb = new ExcelJS.Workbook()
    wb.creator = "Taller Mecánico - Sistema de Gestión"
    wb.created = new Date()

    const ws = wb.addWorksheet("Orden de Servicio", {
      pageSetup: { paperSize: 1, orientation:"portrait", fitToPage:true, margins:{ left:0.5, right:0.5, top:0.5, bottom:0.5 } },
    })

    ws.columns = [
      { width:4 },   // A: #
      { width:28 },  // B: label / nombre
      { width:16 },  // C: value / lado
      { width:10 },  // D: cantidad
      { width:16 },  // E: precio unitario
      { width:16 },  // F: subtotal
    ]

    // ── Header ──
    ws.mergeCells("A1:F1")
    const titleCell = ws.getCell("A1")
    titleCell.value = "TALLER MECÁNICO — SISTEMA DE GESTIÓN"
    titleCell.font = { name:"Arial", size:14, bold:true, color:{ argb:WHITE } }
    titleCell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:NAVY } }
    titleCell.alignment = { horizontal:"center", vertical:"middle" }
    ws.getRow(1).height = 36

    ws.mergeCells("A2:F2")
    const redBar = ws.getCell("A2")
    redBar.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:RED } }
    ws.getRow(2).height = 4

    // ── Orden Info ──
    ws.mergeCells("A3:F3")
    const ordenTitle = ws.getCell("A3")
    ordenTitle.value = `ORDEN DE SERVICIO #${String(orden.id_orden).padStart(4,"0")}`
    ordenTitle.font = { name:"Arial", size:12, bold:true, color:{ argb:NAVY } }
    ordenTitle.alignment = { horizontal:"center", vertical:"middle" }
    ws.getRow(3).height = 30

    const fechaCreacion = new Date(orden.fecha_creacion).toLocaleDateString("es-MX", { day:"2-digit", month:"long", year:"numeric" })
    const horaCreacion  = new Date(orden.fecha_creacion).toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit" })

    const infoRows = [
      ["Fecha:", `${fechaCreacion} — ${horaCreacion}`],
      ["Estado:", ESTADO_LABELS[orden.estado] || orden.estado],
      ["Atendió:", orden.usuario ? orden.usuario.nombre || orden.usuario.username : "—"],
    ]
    if (orden.observaciones) infoRows.push(["Observaciones:", orden.observaciones])

    let row = 4
    for (const [label, value] of infoRows) {
      ws.mergeCells(`C${row}:F${row}`)
      const labelCell = ws.getCell(`B${row}`)
      labelCell.value = label
      labelCell.font = { name:"Arial", size:10, bold:true, color:{ argb:NAVY } }
      labelCell.alignment = { horizontal:"right", vertical:"middle" }
      const valCell = ws.getCell(`C${row}`)
      valCell.value = value
      valCell.font = { name:"Arial", size:10 }
      valCell.alignment = { horizontal:"left", vertical:"middle" }
      row++
    }

    // ── Cliente Section ──
    row++
    ws.mergeCells(`A${row}:F${row}`)
    const clienteHeader = ws.getCell(`A${row}`)
    clienteHeader.value = "  DATOS DEL CLIENTE"
    clienteHeader.font = { name:"Arial", size:10, bold:true, color:{ argb:WHITE } }
    clienteHeader.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:NAVY } }
    clienteHeader.alignment = { vertical:"middle" }
    ws.getRow(row).height = 26
    row++

    const nombreCompleto = [orden.cliente.nombre, orden.cliente.apellido_paterno, orden.cliente.apellido_materno].filter(Boolean).join(" ")
    const clienteData = [
      ["Nombre:", nombreCompleto],
      ["RFC:", orden.cliente.rfc],
      ["Teléfono:", orden.cliente.telefono || "—"],
      ["Correo:", orden.cliente.correo || "—"],
    ]
    for (const [label, value] of clienteData) {
      ws.mergeCells(`C${row}:F${row}`)
      const lc = ws.getCell(`B${row}`)
      lc.value = label
      lc.font = { name:"Arial", size:10, bold:true, color:{ argb:"6B7280" } }
      lc.alignment = { horizontal:"right", vertical:"middle" }
      lc.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:GRAY_BG } }
      const vc = ws.getCell(`C${row}`)
      vc.value = value
      vc.font = { name:"Arial", size:10 }
      vc.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:GRAY_BG } }
      ws.getCell(`A${row}`).fill = { type:"pattern", pattern:"solid", fgColor:{ argb:GRAY_BG } }
      row++
    }

    // ── Vehículo Section ──
    row++
    ws.mergeCells(`A${row}:F${row}`)
    const vehHeader = ws.getCell(`A${row}`)
    vehHeader.value = "  DATOS DEL VEHÍCULO"
    vehHeader.font = { name:"Arial", size:10, bold:true, color:{ argb:WHITE } }
    vehHeader.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:NAVY } }
    vehHeader.alignment = { vertical:"middle" }
    ws.getRow(row).height = 26
    row++

    const vehiculoData = [
      ["Marca:", orden.vehiculo.marca || "—"],
      ["Modelo:", orden.vehiculo.modelo],
      ["Año:", String(orden.vehiculo.anio)],
      ["Color:", orden.vehiculo.color || "—"],
      ["Placas:", orden.vehiculo.placas],
    ]
    for (const [label, value] of vehiculoData) {
      ws.mergeCells(`C${row}:F${row}`)
      const lc = ws.getCell(`B${row}`)
      lc.value = label
      lc.font = { name:"Arial", size:10, bold:true, color:{ argb:"6B7280" } }
      lc.alignment = { horizontal:"right", vertical:"middle" }
      lc.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:GRAY_BG } }
      const vc = ws.getCell(`C${row}`)
      vc.value = value
      vc.font = { name:"Arial", size:10 }
      vc.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:GRAY_BG } }
      ws.getCell(`A${row}`).fill = { type:"pattern", pattern:"solid", fgColor:{ argb:GRAY_BG } }
      row++
    }

    // ── Refacciones Table ──
    row++
    ws.mergeCells(`A${row}:F${row}`)
    const refHeader = ws.getCell(`A${row}`)
    refHeader.value = "  REFACCIONES Y PIEZAS"
    refHeader.font = { name:"Arial", size:10, bold:true, color:{ argb:WHITE } }
    refHeader.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:NAVY } }
    refHeader.alignment = { vertical:"middle" }
    ws.getRow(row).height = 26
    row++

    const tableHeaders = ["#", "Refacción", "Lado", "Cantidad", "P. Unitario", "Subtotal"]
    const headerRow = ws.getRow(row)
    tableHeaders.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = h
      cell.font = { name:"Arial", size:9, bold:true, color:{ argb:NAVY } }
      cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"E8EDF5" } }
      cell.alignment = { horizontal: i >= 3 ? "right" : "left", vertical:"middle" }
      cell.border = thinBorder()
    })
    headerRow.height = 24
    row++

    let subtotalRefacciones = 0
    orden.detalles.forEach((d, i) => {
      const precio = Number(d.precio_unitario)
      const sub = precio * d.cantidad
      subtotalRefacciones += sub

      const dataRow = ws.getRow(row)
      const values = [i + 1, d.refaccion.nombre, LADO_LABELS[d.refaccion.lado] || "N/A", d.cantidad, precio, sub]
      values.forEach((v, ci) => {
        const cell = dataRow.getCell(ci + 1)
        cell.value = v
        cell.font = { name:"Arial", size:10 }
        cell.border = thinBorder()
        cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb: i % 2 === 0 ? WHITE : GRAY_BG } }
        if (ci >= 3) cell.alignment = { horizontal:"right" }
        if (ci === 4 || ci === 5) cell.numFmt = '$#,##0.00'
        if (ci === 0) { cell.font = { name:"Arial", size:9, color:{ argb:"9CA3AF" } }; cell.alignment = { horizontal:"center" } }
        if (ci === 1) cell.font = { name:"Arial", size:10, bold:true, color:{ argb:NAVY } }
      })
      row++
    })

    // ── Financial Summary ──
    row++
    const summaryData = []

    if (orden.venta) {
      const manoObra = Number(orden.venta.mano_obra)
      const iva = Number(orden.venta.iva)
      const total = Number(orden.venta.precio_total)
      const base = subtotalRefacciones + manoObra

      summaryData.push(
        { label:"Subtotal Refacciones:", value:subtotalRefacciones },
        { label:"Mano de Obra:", value:manoObra },
        { label:"Base:", value:base, bold:true },
        { label:"IVA (16%):", value:iva },
        { label:"TOTAL:", value:total, total:true },
      )
    } else {
      summaryData.push(
        { label:"Subtotal Refacciones:", value:subtotalRefacciones },
        { label:"(Venta no registrada)", value:null },
      )
    }

    for (const item of summaryData) {
      ws.mergeCells(`A${row}:D${row}`)
      const labelCell = ws.getCell(`E${row}`)
      labelCell.value = item.label
      labelCell.font = { name:"Arial", size:item.total ? 11 : 10, bold:true, color:{ argb: item.total ? WHITE : NAVY } }
      labelCell.alignment = { horizontal:"right", vertical:"middle" }

      const valCell = ws.getCell(`F${row}`)
      if (item.value !== null) {
        valCell.value = item.value
        valCell.numFmt = '$#,##0.00'
      }
      valCell.font = { name:"Arial", size:item.total ? 12 : 10, bold:item.bold || item.total, color:{ argb: item.total ? WHITE : NAVY } }
      valCell.alignment = { horizontal:"right", vertical:"middle" }

      if (item.total) {
        labelCell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:NAVY } }
        valCell.fill   = { type:"pattern", pattern:"solid", fgColor:{ argb:NAVY } }
        ws.getRow(row).height = 28
      }
      row++
    }

    // ── Payment Info ──
    if (orden.venta) {
      row++
      ws.mergeCells(`A${row}:F${row}`)
      const payHeader = ws.getCell(`A${row}`)
      payHeader.value = "  DATOS DE PAGO"
      payHeader.font = { name:"Arial", size:10, bold:true, color:{ argb:WHITE } }
      payHeader.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:NAVY } }
      payHeader.alignment = { vertical:"middle" }
      ws.getRow(row).height = 26
      row++

      const fechaVenta = new Date(orden.venta.fecha_venta).toLocaleDateString("es-MX", { day:"2-digit", month:"long", year:"numeric" })
      const payData = [
        ["Folio Venta:", `V-${String(orden.venta.id_venta).padStart(4,"0")}`],
        ["Fecha de Pago:", fechaVenta],
        ["Método de Pago:", METODO_LABELS[orden.venta.metodo_pago] || orden.venta.metodo_pago],
        ["Estado de Pago:", orden.venta.estado_pago === "pagado" ? "Pagado" : orden.venta.estado_pago],
      ]
      for (const [label, value] of payData) {
        ws.mergeCells(`C${row}:F${row}`)
        const lc = ws.getCell(`B${row}`)
        lc.value = label
        lc.font = { name:"Arial", size:10, bold:true, color:{ argb:"6B7280" } }
        lc.alignment = { horizontal:"right", vertical:"middle" }
        lc.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:GRAY_BG } }
        const vc = ws.getCell(`C${row}`)
        vc.value = value
        vc.font = { name:"Arial", size:10, bold: label.includes("Estado") }
        vc.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:GRAY_BG } }
        if (label.includes("Estado") && value === "Pagado") vc.font = { name:"Arial", size:10, bold:true, color:{ argb:"15803D" } }
        ws.getCell(`A${row}`).fill = { type:"pattern", pattern:"solid", fgColor:{ argb:GRAY_BG } }
        row++
      }
    }

    // ── Footer ──
    row += 2
    ws.mergeCells(`A${row}:F${row}`)
    const footer = ws.getCell(`A${row}`)
    footer.value = `Documento generado el ${new Date().toLocaleDateString("es-MX")} a las ${new Date().toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit" })} — Taller Mecánico Sistema de Gestión`
    footer.font = { name:"Arial", size:8, italic:true, color:{ argb:"9CA3AF" } }
    footer.alignment = { horizontal:"center" }

    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=Orden_${String(orden.id_orden).padStart(4,"0")}.xlsx`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: "Error al generar el archivo Excel" }, { status: 500 })
  }
}
