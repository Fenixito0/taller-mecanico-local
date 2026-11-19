<?php
// GET api/bitacora.php?desde=&hasta=&q=&modulo=&pagina=1 → registros de auditoría (admin)

require __DIR__ . '/../includes/bootstrap.php';
require_api_admin();

const POR_PAGINA = 50;

try {
    [$desde, $hasta] = rango_fechas($_GET['desde'] ?? null, $_GET['hasta'] ?? null);
    $where = ['a.fecha BETWEEN ? AND ?'];
    $params = [to_utc_sql($desde), to_utc_sql($hasta)];

    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q !== '') {
        $where[] = '(a.accion LIKE ? OR a.username LIKE ?)';
        $like = '%' . addcslashes($q, '%_\\') . '%';
        array_push($params, $like, $like);
    }
    $modulo = trim((string) ($_GET['modulo'] ?? ''));
    if ($modulo !== '') {
        $where[] = 'a.modulo = ?';
        $params[] = $modulo;
    }
    $sqlWhere = ' WHERE ' . implode(' AND ', $where);

    $total = (int) db_one('SELECT COUNT(*) AS n FROM auditoria a' . $sqlWhere, $params)['n'];
    $pagina = max(1, (int) ($_GET['pagina'] ?? 1));
    $offset = ($pagina - 1) * POR_PAGINA;

    $rows = db_all('SELECT a.* FROM auditoria a' . $sqlWhere . ' ORDER BY a.fecha DESC, a.id_auditoria DESC LIMIT ' . POR_PAGINA . ' OFFSET ' . $offset, $params);
    $modulos = array_column(db_all('SELECT DISTINCT modulo FROM auditoria ORDER BY modulo'), 'modulo');

    json_out([
        'items' => array_map(static fn (array $a): array => [
            'id'       => (int) $a['id_auditoria'],
            'fecha'    => iso_utc($a['fecha']),
            'username' => $a['username'],
            'accion'   => $a['accion'],
            'modulo'   => $a['modulo'],
        ], $rows),
        'total'      => $total,
        'pagina'     => $pagina,
        'paginas'    => max(1, (int) ceil($total / POR_PAGINA)),
        'modulos'    => $modulos,
    ]);
} catch (Throwable $e) {
    log_error('API bitácora', $e);
    json_error('Error al consultar la bitácora', 500);
}
