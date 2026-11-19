<?php
// Generador mínimo de archivos Excel (.xlsx) en PHP puro, sin dependencias.
// Soporta: varias hojas, anchos de columna, altura de filas, celdas combinadas,
// fuentes (Arial), rellenos, alineación, bordes finos y formatos numéricos.
//
// Estilo de celda (arreglo):
//   ['size'=>10, 'bold'=>true, 'italic'=>true, 'color'=>'FFFFFF', 'fill'=>'0F1F3D',
//    'h'=>'left|center|right', 'v'=>'middle', 'border'=>true, 'numFmt'=>'$#,##0.00']

final class XlsxSheet
{
    /** @var array<int, array<int, array{v:mixed, s:int}>> */
    public array $cells = [];
    /** @var array<int, float> */
    public array $widths = [];
    /** @var array<int, float> */
    public array $heights = [];
    /** @var string[] */
    public array $merges = [];

    public function __construct(
        private XlsxWriter $book,
        public string $name,
        public string $orientation = 'portrait',
        public bool $fitToPage = false
    ) {
    }

    /** @param float[] $widths */
    public function setColumns(array $widths): self
    {
        foreach (array_values($widths) as $i => $w) {
            $this->widths[$i + 1] = (float) $w;
        }
        return $this;
    }

    /** Asigna valor y estilo a una celda ("B4"). Valor null = celda solo con estilo. */
    public function set(string $ref, $value, array $style = []): self
    {
        [$col, $row] = self::parseRef($ref);
        $this->cells[$row][$col] = ['v' => $value, 's' => $this->book->styleId($style)];
        return $this;
    }

    public function setRC(int $row, int $col, $value, array $style = []): self
    {
        return $this->set(self::colLetter($col) . $row, $value, $style);
    }

    public function merge(string $range): self
    {
        $this->merges[] = $range;
        return $this;
    }

    public function height(int $row, float $h): self
    {
        $this->heights[$row] = $h;
        return $this;
    }

    public static function colLetter(int $col): string
    {
        $s = '';
        while ($col > 0) {
            $m = ($col - 1) % 26;
            $s = chr(65 + $m) . $s;
            $col = intdiv($col - $m - 1, 26);
        }
        return $s;
    }

    /** @return array{0:int,1:int} [columna, fila] */
    public static function parseRef(string $ref): array
    {
        if (!preg_match('/^([A-Z]+)(\d+)$/', $ref, $m)) {
            throw new InvalidArgumentException("Referencia inválida: {$ref}");
        }
        $col = 0;
        foreach (str_split($m[1]) as $ch) {
            $col = $col * 26 + (ord($ch) - 64);
        }
        return [$col, (int) $m[2]];
    }

    public function toXml(): string
    {
        $x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
        if ($this->fitToPage) {
            $x .= '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
        }
        if ($this->widths) {
            $x .= '<cols>';
            ksort($this->widths);
            foreach ($this->widths as $c => $w) {
                $x .= sprintf('<col min="%d" max="%d" width="%.2f" customWidth="1"/>', $c, $c, $w);
            }
            $x .= '</cols>';
        }
        $x .= '<sheetData>';
        $rows = array_unique(array_merge(array_keys($this->cells), array_keys($this->heights)));
        sort($rows);
        foreach ($rows as $r) {
            $attr = isset($this->heights[$r]) ? sprintf(' ht="%.2f" customHeight="1"', $this->heights[$r]) : '';
            $x .= "<row r=\"{$r}\"{$attr}>";
            $cols = $this->cells[$r] ?? [];
            ksort($cols);
            foreach ($cols as $c => $cell) {
                $x .= $this->cellXml(self::colLetter($c) . $r, $cell['v'], $cell['s']);
            }
            $x .= '</row>';
        }
        $x .= '</sheetData>';
        if ($this->merges) {
            $x .= '<mergeCells count="' . count($this->merges) . '">';
            foreach ($this->merges as $m) {
                $x .= '<mergeCell ref="' . $m . '"/>';
            }
            $x .= '</mergeCells>';
        }
        $x .= '<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>';
        $x .= '<pageSetup paperSize="1" orientation="' . $this->orientation . '"'
            . ($this->fitToPage ? ' fitToWidth="1" fitToHeight="0"' : '') . '/>';
        $x .= '</worksheet>';
        return $x;
    }

    private function cellXml(string $ref, $v, int $s): string
    {
        if ($v === null || $v === '') {
            return "<c r=\"{$ref}\" s=\"{$s}\"/>";
        }
        if (is_int($v) || is_float($v)) {
            return "<c r=\"{$ref}\" s=\"{$s}\"><v>" . (is_float($v) ? rtrim(rtrim(sprintf('%.6F', $v), '0'), '.') : $v) . '</v></c>';
        }
        $t = htmlspecialchars((string) $v, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        return "<c r=\"{$ref}\" s=\"{$s}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{$t}</t></is></c>";
    }
}

final class XlsxWriter
{
    /** @var XlsxSheet[] */
    private array $sheets = [];
    /** @var array<string,int> */
    private array $fonts = [];
    /** @var array<string,int> */
    private array $fills = [];
    /** @var array<string,int> */
    private array $numFmts = [];
    /** @var array<string,int> */
    private array $xfs = [];

    public function __construct(public string $creator = 'Taller Mecánico')
    {
        $this->fontId([]);           // fuente por defecto
        $this->xfs['default'] = 0;   // estilo por defecto
    }

    public function addSheet(string $name, string $orientation = 'portrait', bool $fitToPage = false): XlsxSheet
    {
        $name = mb_substr(preg_replace('/[\\\\\/?*\[\]:]/', '', $name), 0, 31);
        $sheet = new XlsxSheet($this, $name, $orientation, $fitToPage);
        $this->sheets[] = $sheet;
        return $sheet;
    }

    public function styleId(array $s): int
    {
        if (!$s) {
            return 0;
        }
        $font = $this->fontId($s);
        $fill = isset($s['fill']) ? $this->fillId($s['fill']) : 0;
        $border = !empty($s['border']) ? 1 : 0;
        $fmt = isset($s['numFmt']) ? $this->numFmtId($s['numFmt']) : 0;
        $h = $s['h'] ?? null;
        $v = $s['v'] ?? null;
        $wrap = !empty($s['wrap']);
        $key = implode('|', [$font, $fill, $border, $fmt, $h, $v, $wrap]);
        if (!isset($this->xfs[$key])) {
            $this->xfs[$key] = count($this->xfs);
        }
        return $this->xfs[$key];
    }

    private function fontId(array $s): int
    {
        $key = json_encode([$s['size'] ?? 10, !empty($s['bold']), !empty($s['italic']), $s['color'] ?? null]);
        if (!isset($this->fonts[$key])) {
            $this->fonts[$key] = count($this->fonts);
        }
        return $this->fonts[$key];
    }

    private function fillId(string $rgb): int
    {
        if (!isset($this->fills[$rgb])) {
            $this->fills[$rgb] = count($this->fills) + 2; // 0 y 1 están reservados por Excel
        }
        return $this->fills[$rgb];
    }

    private function numFmtId(string $code): int
    {
        if (!isset($this->numFmts[$code])) {
            $this->numFmts[$code] = 164 + count($this->numFmts);
        }
        return $this->numFmts[$code];
    }

    private function stylesXml(): string
    {
        $x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
        if ($this->numFmts) {
            $x .= '<numFmts count="' . count($this->numFmts) . '">';
            foreach ($this->numFmts as $code => $id) {
                $x .= '<numFmt numFmtId="' . $id . '" formatCode="' . htmlspecialchars($code, ENT_XML1 | ENT_QUOTES) . '"/>';
            }
            $x .= '</numFmts>';
        }
        $x .= '<fonts count="' . count($this->fonts) . '">';
        foreach (array_keys($this->fonts) as $key) {
            [$size, $bold, $italic, $color] = json_decode($key, true);
            $x .= '<font>' . ($bold ? '<b/>' : '') . ($italic ? '<i/>' : '')
                . '<sz val="' . $size . '"/>' . ($color ? '<color rgb="FF' . $color . '"/>' : '')
                . '<name val="Arial"/><family val="2"/></font>';
        }
        $x .= '</fonts>';
        $x .= '<fills count="' . (count($this->fills) + 2) . '"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>';
        foreach (array_keys($this->fills) as $rgb) {
            $x .= '<fill><patternFill patternType="solid"><fgColor rgb="FF' . $rgb . '"/><bgColor indexed="64"/></patternFill></fill>';
        }
        $x .= '</fills>';
        $b = '<color rgb="FFE5E7EB"/>';
        $x .= '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'
            . "<border><left style=\"thin\">{$b}</left><right style=\"thin\">{$b}</right><top style=\"thin\">{$b}</top><bottom style=\"thin\">{$b}</bottom><diagonal/></border></borders>";
        $x .= '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';
        $x .= '<cellXfs count="' . count($this->xfs) . '">';
        foreach (array_keys($this->xfs) as $key) {
            if ($key === 'default') {
                $x .= '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';
                continue;
            }
            [$font, $fill, $border, $fmt, $h, $v, $wrap] = explode('|', $key);
            $x .= "<xf numFmtId=\"{$fmt}\" fontId=\"{$font}\" fillId=\"{$fill}\" borderId=\"{$border}\" xfId=\"0\""
                . ($fmt ? ' applyNumberFormat="1"' : '') . ' applyFont="1"' . ($fill ? ' applyFill="1"' : '')
                . ($border ? ' applyBorder="1"' : '');
            if ($h !== '' || $v !== '' || $wrap !== '') {
                $x .= ' applyAlignment="1"><alignment' . ($h !== '' ? " horizontal=\"{$h}\"" : '')
                    . ($v !== '' ? " vertical=\"{$v}\"" : '') . ($wrap !== '' ? ' wrapText="1"' : '') . '/></xf>';
            } else {
                $x .= '/>';
            }
        }
        $x .= '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
        return $x;
    }

    /** Genera el contenido binario del archivo .xlsx */
    public function build(): string
    {
        $n = count($this->sheets);
        $ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>';
        $wbSheets = '';
        $wbRels = '';
        for ($i = 1; $i <= $n; $i++) {
            $ct .= "<Override PartName=\"/xl/worksheets/sheet{$i}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>";
            $nm = htmlspecialchars($this->sheets[$i - 1]->name, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $wbSheets .= "<sheet name=\"{$nm}\" sheetId=\"{$i}\" r:id=\"rId{$i}\"/>";
            $wbRels .= "<Relationship Id=\"rId{$i}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet{$i}.xml\"/>";
        }
        $ct .= '</Types>';
        $wbRels .= '<Relationship Id="rId' . ($n + 1) . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $creator = htmlspecialchars($this->creator, ENT_XML1 | ENT_QUOTES, 'UTF-8');

        $zip = new ZipBuilder();
        $zip->add('[Content_Types].xml', $ct);
        $zip->add('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            . '</Relationships>');
        $zip->add('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            . 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
            . 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            . "<dc:creator>{$creator}</dc:creator>"
            . "<dcterms:created xsi:type=\"dcterms:W3CDTF\">{$now}</dcterms:created>"
            . '</cp:coreProperties>');
        $zip->add('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . "<sheets>{$wbSheets}</sheets></workbook>");
        $zip->add('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">{$wbRels}</Relationships>");
        foreach ($this->sheets as $i => $sheet) {
            $zip->add('xl/worksheets/sheet' . ($i + 1) . '.xml', $sheet->toXml());
        }
        $zip->add('xl/styles.xml', $this->stylesXml());
        return $zip->build();
    }

    /** Envía el archivo al navegador como descarga. */
    public function download(string $filename): void
    {
        $data = $this->build();
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . preg_replace('/[^A-Za-z0-9_.-]/', '_', $filename) . '"');
        header('Content-Length: ' . strlen($data));
        header('Cache-Control: no-store');
        echo $data;
        exit;
    }
}

/** Empaquetador ZIP mínimo (deflate si zlib está disponible, si no "store"). */
final class ZipBuilder
{
    private string $data = '';
    private string $central = '';
    private int $count = 0;

    public function add(string $name, string $content): void
    {
        $crc = crc32($content);
        $usize = strlen($content);
        $method = 0;
        $payload = $content;
        if (function_exists('gzdeflate')) {
            $compressed = gzdeflate($content, 6);
            if ($compressed !== false) {
                $method = 8;
                $payload = $compressed;
            }
        }
        $csize = strlen($payload);
        [$time, $date] = $this->dosTime();
        $offset = strlen($this->data);

        $this->data .= pack('VvvvvvVVVvv', 0x04034b50, 20, 0x0800, $method, $time, $date, $crc, $csize, $usize, strlen($name), 0)
            . $name . $payload;
        $this->central .= pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0x0800, $method, $time, $date, $crc, $csize, $usize, strlen($name), 0, 0, 0, 0, 0, $offset)
            . $name;
        $this->count++;
    }

    public function build(): string
    {
        $cdOffset = strlen($this->data);
        return $this->data . $this->central
            . pack('VvvvvVVv', 0x06054b50, 0, 0, $this->count, $this->count, strlen($this->central), $cdOffset, 0);
    }

    /** @return array{0:int,1:int} */
    private function dosTime(): array
    {
        $t = getdate();
        $time = ($t['hours'] << 11) | ($t['minutes'] << 5) | intdiv($t['seconds'], 2);
        $date = (($t['year'] - 1980) << 9) | ($t['mon'] << 5) | $t['mday'];
        return [$time, $date];
    }
}
