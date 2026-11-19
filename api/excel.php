<?php
// GET api/excel.php?tipo=orden&id=N
// GET api/excel.php?tipo=reporte_ordenes&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// GET api/excel.php?tipo=reporte_ventas&desde=YYYY-MM-DD&hasta=YYYY-MM-DD

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
require __DIR__ . '/../includes/xlsx.php';
require_api_auth();

const NAVY = '0F1F3D';
const RED = 'C8102E';
const WHITE = 'FFFFFF';
const GRAY_BG = 'F9FAFB';
const GREEN = '15803D';
const HEAD_BG = 'E8EDF5';
const MONEY = '$#,##0.00';

const LADO_LABELS = ['izquierdo' => 'Izquierdo', 'derecho' => 'Derecho', 'central' => 'Central', 'NA' => 'N/A'];
const METODO_LABELS = ['efectivo' => 'Efectivo', 'tarjeta' => 'Tarjeta', 'transferencia' => 'Transferencia'];
const ESTADO_LABELS = ['pendiente' => 'Pendiente', 'completado' => 'Completado', 'cancelado' => 'Cancelado'];

try {
    $tipo = $_GET['tipo'] ?? '';
    if ($tipo === 'orden') {
        excel_orden((int) ($_GET['id'] ?? 0));
    }
    [$desde, $hasta] = rango_fechas($_GET['desde'] ?? null, $_GET['hasta'] ?? null);
    if ($tipo !== 'orden' && !es_admin()) {
        json_error('Los reportes son solo para administradores', 403);
    }
    if ($tipo === 'reporte_ordenes') {
        excel_reporte_ordenes($desde, $hasta);
    }
    if ($tipo === 'reporte_ventas') {
        excel_reporte_ventas($desde, $hasta);
    }
    json_error('Tipo de reporte no válido', 400);
} catch (Throwable $e) {
    log_error('Excel', $e);
    json_error('Error al generar el archivo Excel', 500);
}

// ── Helpers de estilo ─────────────────────────────────────────────────

function titulo_principal(XlsxSheet $ws, string $texto, string $ultimaCol): void
{
    $ws->merge("A1:{$ultimaCol}1");
    $ws->set('A1', $texto, ['size' => 14, 'bold' => true, 'color' => WHITE, 'fill' => NAVY, 'h' => 'center', 'v' => 'middle']);
    $ws->height(1, 36);
    $ws->merge("A2:{$ultimaCol}2");
    $ws->set('A2', null, ['fill' => RED]);
    $ws->height(2, 4);
}

function encabezado_seccion(XlsxSheet $ws, int $row, string $texto): void
{
    $ws->merge("A{$row}:F{$row}");
    $ws->set("A{$row}", "  {$texto}", ['bold' => true, 'color' => WHITE, 'fill' => NAVY, 'v' => 'middle']);
    $ws->height($row, 26);
}

/** Filas "Etiqueta: valor" con fondo gris. Devuelve la siguiente fila libre. */
function filas_datos(XlsxSheet $ws, int $row, array $datos, ?callable $estiloValor = null): int
{
    foreach ($datos as [$label, $value]) {
        $ws->merge("C{$row}:F{$row}");
        $ws->set("A{$row}", null, ['fill' => GRAY_BG]);
        $ws->set("B{$row}", $label, ['bold' => true, 'color' => '6B7280', 'h' => 'right', 'v' => 'middle', 'fill' => GRAY_BG]);
        $estilo = $estiloValor ? $estiloValor($label, $value) : ['fill' => GRAY_BG];
        $ws->set("C{$row}", $value, $estilo);
        $row++;
    }
    return $row;
}

// ── Orden individual ──────────────────────────────────────────────────

function excel_orden(int $id): void
{
    $orden = $id > 0 ? obtener_orden($id) : null;
    if ($orden === null) {
        json_error('Orden no encontrada', 404);
    }

    $wb = new XlsxWriter('Taller Mecánico - Sistema de Gestión');
    $ws = $wb->addSheet('Orden de Servicio', 'portrait', true);
    $ws->setColumns([4, 28, 16, 10, 16, 16]);

    titulo_principal($ws, mb_strtoupper(config_taller()['nombre_taller']) . ' — ORDEN DE SERVICIO', 'F');

    $ws->merge('A3:F3');
    $ws->set('A3', 'ORDEN DE SERVICIO #' . pad4($orden['id_orden']), ['size' => 12, 'bold' => true, 'color' => NAVY, 'h' => 'center', 'v' => 'middle']);
    $ws->height(3, 30);

    $fc = local_dt($orden['fecha_creacion']);
    $info = [
        ['Fecha:', fecha_larga($fc) . ' — ' . $fc->format('H:i')],
        ['Estado:', ESTADO_LABELS[$orden['estado']] ?? $orden['estado']],
        ['Atendió:', $orden['usuario'] ?? '—'],
    ];
    if ($orden['observaciones']) {
        $info[] = ['Observaciones:', $orden['observaciones']];
    }
    $row = 4;
    foreach ($info as [$label, $value]) {
        $ws->merge("C{$row}:F{$row}");
        $ws->set("B{$row}", $label, ['bold' => true, 'color' => NAVY, 'h' => 'right', 'v' => 'middle']);
        $ws->set("C{$row}", $value, ['h' => 'left', 'v' => 'middle']);
        $row++;
    }

    $c = $orden['cliente'];
    $row++;
    encabezado_seccion($ws, $row++, 'DATOS DEL CLIENTE');
    $row = filas_datos($ws, $row, [
        ['Nombre:', nombre_completo($c)],
        ['RFC:', $c['rfc']],
        ['Teléfono:', $c['telefono'] ?: '—'],
        ['Correo:', $c['correo'] ?: '—'],
    ]);

    $v = $orden['vehiculo'];
    $row++;
    encabezado_seccion($ws, $row++, 'DATOS DEL VEHÍCULO');
    $row = filas_datos($ws, $row, [
        ['Marca:', $v['marca'] ?: '—'],
        ['Modelo:', $v['modelo']],
        ['Año:', (string) $v['anio']],
        ['Color:', $v['color'] ?: '—'],
        ['Placas:', $v['placas']],
        ['Kilometraje:', $orden['kilometraje'] !== null ? number_format($orden['kilometraje']) . ' km' : '—'],
    ]);

    $row++;
    encabezado_seccion($ws, $row++, 'PIEZAS A CAMBIO');
    foreach (['#', 'Pieza', 'Lado / origen', 'Cantidad', 'Estado', 'Importe'] as $i => $h) {
        $ws->setRC($row, $i + 1, $h, ['size' => 9, 'bold' => true, 'color' => NAVY, 'fill' => HEAD_BG, 'h' => $i === 3 || $i === 5 ? 'right' : 'left', 'v' => 'middle', 'border' => true]);
    }
    $ws->height($row++, 24);

    $estados = ['pendiente' => 'Pendiente', 'recibida' => 'Recibida', 'instalada' => 'Instalada', 'devuelta' => 'Devuelta'];
    foreach ($orden['piezas'] as $i => $d) {
        $fill = $i % 2 === 0 ? WHITE : GRAY_BG;
        $base = ['fill' => $fill, 'border' => true];
        $cobrable = $d['estado'] !== 'devuelta' && $d['precio_unitario'] !== null;
        $ws->setRC($row, 1, $i + 1, $base + ['size' => 9, 'color' => '9CA3AF', 'h' => 'center']);
        $ws->setRC($row, 2, ($d['es_extra'] ? 'EXTRA · ' : '') . $d['nombre'], $base + ['bold' => true, 'color' => NAVY]);
        $ws->setRC($row, 3, (LADO_LABELS[$d['lado']] ?? 'N/A') . ' · ' . ($d['origen'] === 'aseguradora' ? 'Aseguradora' : 'Taller'), $base);
        $ws->setRC($row, 4, $d['cantidad'], $base + ['h' => 'right']);
        $ws->setRC($row, 5, $estados[$d['estado']] ?? $d['estado'], $base);
        $ws->setRC($row, 6, $cobrable ? $d['precio_unitario'] * $d['cantidad'] : ($d['estado'] === 'devuelta' ? 'Devuelta' : 'Sin cargo'),
            $base + ['h' => 'right'] + ($cobrable ? ['numFmt' => MONEY] : ['color' => '9CA3AF']));
        $row++;
    }
    foreach ($orden['cargos'] as $c) {
        $base = ['fill' => GRAY_BG, 'border' => true];
        $ws->merge("B{$row}:E{$row}");
        $ws->setRC($row, 2, ($c['tipo'] === 'extra' ? 'EXTRA · ' : '') . $c['concepto'], $base + ['color' => NAVY]);
        $ws->setRC($row, 6, $c['monto'], $base + ['h' => 'right', 'numFmt' => MONEY]);
        $row++;
    }

    $row++;
    $venta = $orden['venta'];
    $seguro = $orden['tipo'] === 'seguro';
    if ($venta) {
        $resumen = [['Piezas:', $venta['piezas'], false, false]];
        if (!$seguro || $venta['mano_obra'] > 0) {
            $resumen[] = ['Mano de Obra:', $venta['mano_obra'], false, false];
        }
        $resumen[] = ['Extras:', $venta['extras'], false, false];
        if ($venta['descuento'] > 0) {
            $resumen[] = ['Descuento:', -$venta['descuento'], false, false];
        }
        $resumen[] = ['IVA (16%):', $venta['iva'], false, false];
        if ($venta['deducible'] > 0) {
            $resumen[] = ['Deducible (IVA incl.):', $venta['deducible'], false, false];
        }
        $resumen[] = ['TOTAL:', $venta['precio_total'], true, true];
        if ($venta['anticipo'] > 0) {
            $resumen[] = ['Anticipos:', $venta['anticipo'], false, false];
            $resumen[] = ['Pagado al entregar:', $venta['precio_total'] - $venta['anticipo'], true, false];
        }
    } else {
        $k = calcular_cobro($orden['tipo'], $orden['piezas'], $orden['cargos'], (float) $orden['deducible'], 'monto', 0.0, true, 0.0);
        $resumen = [
            ['Total estimado:', $k['total'], true, false],
            ['(Venta no registrada)', null, false, false],
        ];
    }
    foreach ($resumen as [$label, $value, $bold, $total]) {
        $ws->merge("A{$row}:D{$row}");
        $color = $total ? WHITE : NAVY;
        $fill = $total ? ['fill' => NAVY] : [];
        $ws->set("E{$row}", $label, ['size' => $total ? 11 : 10, 'bold' => true, 'color' => $color, 'h' => 'right', 'v' => 'middle'] + $fill);
        $ws->set("F{$row}", $value, ['size' => $total ? 12 : 10, 'bold' => $bold, 'color' => $color, 'h' => 'right', 'v' => 'middle', 'numFmt' => MONEY] + $fill);
        if ($total) {
            $ws->height($row, 28);
        }
        $row++;
    }

    if ($venta) {
        $row++;
        encabezado_seccion($ws, $row++, 'DATOS DE PAGO');
        $estadoPago = $venta['estado_pago'] === 'pagado' ? 'Pagado' : $venta['estado_pago'];
        $row = filas_datos($ws, $row, [
            ['Folio Venta:', 'V-' . pad4($venta['id_venta'])],
            ['Fecha de Pago:', fecha_larga(local_dt($venta['fecha_venta']))],
            ['Método de Pago:', METODO_LABELS[$venta['metodo_pago']] ?? $venta['metodo_pago']],
            ['Estado de Pago:', $estadoPago],
        ], static function (string $label, $value): array {
            if ($label === 'Estado de Pago:') {
                return ['fill' => GRAY_BG, 'bold' => true] + ($value === 'Pagado' ? ['color' => GREEN] : []);
            }
            return ['fill' => GRAY_BG];
        });
    }

    $row += 2;
    $ahora = new DateTimeImmutable();
    $ws->merge("A{$row}:F{$row}");
    $ws->set("A{$row}", 'Documento generado el ' . fecha_corta($ahora) . ' a las ' . $ahora->format('H:i') . ' — Taller Mecánico Sistema de Gestión',
        ['size' => 8, 'italic' => true, 'color' => '9CA3AF', 'h' => 'center']);

    $wb->download('Orden_' . pad4($orden['id_orden']) . '.xlsx');
}

// ── Reporte de órdenes ────────────────────────────────────────────────

function periodo_texto(DateTimeImmutable $desde, DateTimeImmutable $hasta): string
{
    return 'Periodo: ' . fecha_larga($desde) . ' — ' . fecha_larga($hasta);
}

function excel_reporte_ordenes(DateTimeImmutable $desde, DateTimeImmutable $hasta): void
{
    $data = reporte_ordenes($desde, $hasta);
    $wb = new XlsxWriter();
    $ws = $wb->addSheet('Reporte Órdenes', 'landscape');
    $ws->setColumns([10, 18, 14, 28, 16, 22, 12, 10, 16, 16]);

    titulo_principal($ws, mb_strtoupper(config_taller()['nombre_taller']) . ' — REPORTE DE ÓRDENES', 'J');
    $ws->merge('A3:J3');
    $ws->set('A3', periodo_texto($desde, $hasta), ['size' => 11, 'bold' => true, 'color' => NAVY, 'h' => 'center', 'v' => 'middle']);
    $ws->height(3, 28);

    $r = $data['resumen'];
    $ws->merge('A4:J4');
    $ws->set('A4', "Total: {$r['total']}  |  Pendientes: {$r['pendientes']}  |  Completadas: {$r['completadas']}  |  Canceladas: {$r['canceladas']}", ['h' => 'center', 'v' => 'middle']);
    $ws->height(4, 24);

    foreach (['# Orden', 'Fecha', 'Estado', 'Cliente', 'Tipo', 'Vehículo', 'Placas', 'Piezas', 'Por instalar', 'Total Venta'] as $i => $h) {
        $ws->setRC(6, $i + 1, $h, ['size' => 9, 'bold' => true, 'color' => WHITE, 'fill' => NAVY, 'h' => $i >= 7 ? 'right' : 'left', 'v' => 'middle']);
    }
    $ws->height(6, 24);

    $colores = ['pendiente' => 'B45309', 'completado' => GREEN, 'cancelado' => RED];
    foreach ($data['ordenes'] as $idx => $o) {
        $row = 7 + $idx;
        $fill = ['fill' => $idx % 2 === 0 ? WHITE : GRAY_BG];
        $vals = [
            '#' . pad4($o['id_orden']),
            fecha_corta(local_dt($o['fecha_raw'])),
            ESTADO_LABELS[$o['estado']],
            $o['cliente'],
            $o['tipo'] === 'seguro' ? ($o['aseguradora'] ?: 'Seguro') : 'Particular',
            $o['vehiculo'],
            $o['placas'],
            $o['num_piezas'],
            $o['piezas_pendientes'],
            $o['total_venta'],
        ];
        foreach ($vals as $i => $v) {
            $st = $fill;
            if ($i >= 7) {
                $st['h'] = 'right';
            }
            if ($i === 9) {
                $st['numFmt'] = MONEY;
            }
            if ($i === 2) {
                $st += ['bold' => true, 'color' => $colores[$o['estado']] ?? NAVY];
            }
            $ws->setRC($row, $i + 1, $v, $st);
        }
    }

    $wb->download('Reporte_Ordenes_' . $desde->format('Y-m-d') . '_' . $hasta->format('Y-m-d') . '.xlsx');
}

// ── Reporte de ingresos ───────────────────────────────────────────────

function excel_reporte_ventas(DateTimeImmutable $desde, DateTimeImmutable $hasta): void
{
    $data = reporte_ventas($desde, $hasta, 0);
    $r = $data['resumen'];
    $ventas = $data['ventas'];

    $wb = new XlsxWriter();
    $ws = $wb->addSheet('Reporte Ingresos', 'landscape');
    $ws->setColumns([10, 10, 18, 26, 22, 14, 14, 14, 14, 14, 14, 16]);

    titulo_principal($ws, mb_strtoupper(config_taller()['nombre_taller']) . ' — REPORTE DE INGRESOS', 'L');
    $ws->merge('A3:L3');
    $ws->set('A3', periodo_texto($desde, $hasta), ['size' => 11, 'bold' => true, 'color' => NAVY, 'h' => 'center', 'v' => 'middle']);
    $ws->height(3, 28);

    $ws->merge('A4:L4');
    $ws->set('A4', sprintf('Ventas: %d  |  Ingresos: $%.2f  |  Ticket promedio: $%.2f', $r['total_ventas'], $r['total_ingresos'], $r['promedio_ticket']),
        ['bold' => true, 'color' => GREEN, 'h' => 'center', 'v' => 'middle']);
    $ws->height(4, 24);

    foreach (['Folio', 'Orden', 'Fecha', 'Cliente', 'Vehículo', 'Método', 'Piezas', 'M. Obra', 'Extras', 'IVA', 'Deducible', 'Total'] as $i => $h) {
        $ws->setRC(6, $i + 1, $h, ['size' => 9, 'bold' => true, 'color' => WHITE, 'fill' => NAVY, 'h' => $i >= 6 ? 'right' : 'left', 'v' => 'middle']);
    }
    $ws->height(6, 24);

    foreach ($ventas as $idx => $v) {
        $row = 7 + $idx;
        $fill = ['fill' => $idx % 2 === 0 ? WHITE : GRAY_BG];
        $vals = [
            'V-' . pad4($v['id_venta']),
            '#' . pad4($v['id_orden']),
            fecha_corta(local_dt($v['fecha_raw'])),
            $v['cliente'],
            $v['vehiculo'],
            METODO_LABELS[$v['metodo_pago']],
            $v['piezas'], $v['mano_obra'], $v['extras'], $v['iva'], $v['deducible'], $v['total'],
        ];
        foreach ($vals as $i => $val) {
            $ws->setRC($row, $i + 1, $val, $i >= 6 ? $fill + ['h' => 'right', 'numFmt' => MONEY] : $fill);
        }
    }

    $tot = 7 + count($ventas);
    $navyBold = ['size' => 11, 'bold' => true, 'color' => WHITE, 'fill' => NAVY, 'h' => 'right', 'v' => 'middle'];
    $ws->merge("A{$tot}:E{$tot}");
    $ws->set("A{$tot}", 'TOTALES', $navyBold);
    $ws->set("F{$tot}", null, ['fill' => NAVY]);
    $totales = [$r['total_piezas'], $r['total_mano_obra'], $r['total_extras'], $r['total_iva'], $r['total_deducibles'], $r['total_ingresos']];
    foreach (['G', 'H', 'I', 'J', 'K', 'L'] as $i => $col) {
        $ws->set("{$col}{$tot}", $totales[$i], $navyBold + ['numFmt' => MONEY]);
    }
    $ws->height($tot, 28);

    // Hoja 2: piezas más cambiadas
    $ws2 = $wb->addSheet('Top Piezas');
    $ws2->setColumns([6, 36, 14, 18]);
    $ws2->merge('A1:D1');
    $ws2->set('A1', 'PIEZAS MÁS CAMBIADAS', ['size' => 12, 'bold' => true, 'color' => WHITE, 'fill' => NAVY, 'h' => 'center', 'v' => 'middle']);
    $ws2->height(1, 30);
    foreach (['#', 'Pieza', 'Cantidad', 'Cobrado al cliente'] as $i => $h) {
        $ws2->setRC(2, $i + 1, $h, ['size' => 9, 'bold' => true, 'color' => NAVY, 'fill' => HEAD_BG, 'h' => $i >= 2 ? 'right' : 'left']);
    }
    foreach ($data['top_piezas'] as $i => $ref) {
        $fill = ['fill' => $i % 2 === 0 ? WHITE : GRAY_BG];
        $row = 3 + $i;
        $ws2->setRC($row, 1, $i + 1, $fill);
        $ws2->setRC($row, 2, $ref['nombre'], $fill);
        $ws2->setRC($row, 3, $ref['cantidad'], $fill + ['h' => 'right']);
        $ws2->setRC($row, 4, $ref['ingreso'], $fill + ['h' => 'right', 'numFmt' => MONEY]);
    }

    $wb->download('Reporte_Ingresos_' . $desde->format('Y-m-d') . '_' . $hasta->format('Y-m-d') . '.xlsx');
}
