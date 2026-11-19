<?php
// Utilidades generales: respuestas JSON, fechas y formato.

/** Escapa texto para HTML. */
function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Envía una respuesta JSON y termina la ejecución. */
function json_out($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $mensaje, int $status): void
{
    json_out(['error' => $mensaje], $status);
}

/** Lee el cuerpo JSON de la petición; devuelve [] si está vacío o es inválido. */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Obtiene un string recortado del body; null si no viene o está vacío. */
function str_or_null(array $body, string $key): ?string
{
    if (!isset($body[$key]) || $body[$key] === null) {
        return null;
    }
    $v = trim((string) $body[$key]);
    return $v === '' ? null : $v;
}

function request_method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

/** Registra el error en el log de PHP sin exponer detalles al cliente. */
function log_error(string $contexto, Throwable $e): void
{
    error_log(sprintf('[taller] %s: %s en %s:%d', $contexto, $e->getMessage(), $e->getFile(), $e->getLine()));
}

// ── Fechas ────────────────────────────────────────────────────────────
// La BD guarda las fechas en UTC (compatibilidad con los datos existentes).

/** Fecha/hora actual en UTC con milisegundos, lista para MySQL DATETIME(3). */
function now_utc(): string
{
    $d = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    return $d->format('Y-m-d H:i:s.v');
}

/** Convierte un DATETIME de MySQL (UTC) a ISO-8601 para el navegador. */
function iso_utc(?string $mysql): ?string
{
    if ($mysql === null || $mysql === '') {
        return null;
    }
    $d = new DateTimeImmutable($mysql, new DateTimeZone('UTC'));
    return $d->format('Y-m-d\TH:i:s.v\Z');
}

/** Convierte un DATETIME de MySQL (UTC) a la zona horaria local. */
function local_dt(string $mysql): DateTimeImmutable
{
    $d = new DateTimeImmutable($mysql, new DateTimeZone('UTC'));
    return $d->setTimezone(new DateTimeZone(date_default_timezone_get()));
}

/**
 * Calcula el rango [desde, hasta] (hora local) a partir de los parámetros ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD.
 * Si faltan, usa la semana actual (lunes 00:00 a domingo 23:59:59.999).
 * @return array{0:DateTimeImmutable,1:DateTimeImmutable}
 */
function rango_fechas(?string $desde, ?string $hasta): array
{
    $tz = new DateTimeZone(date_default_timezone_get());
    $hoy = new DateTimeImmutable('today', $tz);
    $diasDesdeLunes = ((int) $hoy->format('N')) - 1;
    $lunes = $hoy->modify("-{$diasDesdeLunes} days");
    $domingo = $lunes->modify('+6 days')->setTime(23, 59, 59, 999000);

    $d = es_fecha_valida($desde) ? new DateTimeImmutable($desde . ' 00:00:00', $tz) : $lunes;
    $h = es_fecha_valida($hasta) ? new DateTimeImmutable($hasta . ' 23:59:59.999', $tz) : $domingo;
    return [$d, $h];
}

function es_fecha_valida(?string $s): bool
{
    if ($s === null || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
        return false;
    }
    [$y, $m, $d] = array_map('intval', explode('-', $s));
    return checkdate($m, $d, $y);
}

/** Convierte una fecha local a string UTC para comparar en MySQL. */
function to_utc_sql(DateTimeImmutable $d): string
{
    return $d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "13 de noviembre de 2026" */
function fecha_larga(DateTimeImmutable $d): string
{
    return $d->format('d') . ' de ' . MESES_ES[(int) $d->format('n') - 1] . ' de ' . $d->format('Y');
}

/** "13/11/2026" */
function fecha_corta(DateTimeImmutable $d): string
{
    return $d->format('d/m/Y');
}

/** Rellena con ceros a la izquierda: 5 → "0005" */
function pad4($n): string
{
    return str_pad((string) $n, 4, '0', STR_PAD_LEFT);
}

// ── Enumeraciones ─────────────────────────────────────────────────────

/** En la BD el lado "sin lado" se guarda como "N/A"; en el navegador se usa "NA". */
function lado_a_cliente(?string $lado): string
{
    return ($lado === null || $lado === 'N/A') ? 'NA' : $lado;
}

function lado_a_bd(?string $lado): string
{
    $validos = ['izquierdo', 'derecho', 'central'];
    return in_array($lado, $validos, true) ? $lado : 'N/A';
}
