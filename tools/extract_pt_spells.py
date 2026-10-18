"""Extrai as magias dos PDFs em português para JSON intermediário.

Uso: python3 tools/extract_pt_spells.py <pasta-dos-pdfs> <saida.json>
"""
import html
import json
import re
import subprocess
import sys
from pathlib import Path

# arquivo (trecho do nome) -> (sigla, nome, deslocamento página impressa - página do PDF)
BOOKS = {
    'Livro do Jogador': ('LDJ', 'Livro do Jogador', 0),
    'Xanathar': ('GXTC', 'Guia de Xanathar para Todas as Coisas', -1),
    'Tasha': ('CTCT', 'Caldeirão de Tasha para Todas as Coisas', -1),
    'Fizban': ('TDF', 'Tesouro dos Dragões de Fizban', -1),
    'Livro do Mestre': ('LDM', 'Livro do Mestre', 0),
}

SCHOOLS = 'abjuração|adivinhação|conjuração|invocação|encantamento|evocação|ilusão|necromancia|transmutação'
OCR_DIGIT = {'I': '1', 'l': '1', 'i': '1', 'O': '0', 'o': '0'}
TAIL = r'\s*(\(ritual\))?[\s·.•]*$'
LEVEL_RE = re.compile(rf'^([0-9IlO])\s*[°ºo]?\s*(?:c[ií]rculo|n[ií]vel)\s*,?\s*({SCHOOLS}){TAIL}', re.I)
CANTRIP_RE = re.compile(rf'^truque\s*(?:,|de)?\s*({SCHOOLS}){TAIL}', re.I)
CANTRIP_REV_RE = re.compile(rf'^({SCHOOLS})\s*,\s*truque{TAIL}', re.I)
# Alguns blocos do livro em português ficaram com os rótulos em inglês.
FIELD_RE = re.compile(r"^(Tempo de Conjura[çc][ãa]o|Alcance|Componentes|Dura[çc][ãa]o|Casting Time|Range|Components|Du'?r'?ation)\s*:\s*(.*)$", re.I)
JUNK_RE = re.compile(r'^(PARTE\s*\d.*|CAP[IÍ]TULO\s*\d+.*|[0-9IlO]{1,3}|\.{2,}|[•·|]+)$')
SUBHEAD_RE = re.compile(r'^((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wà-úç\'’-]*)(?:\s+(?:[\wà-úç\'’-]+)){0,5})\.\s+(?=\S)')
HIGHER_RE = re.compile(r'^Em C[ií]rculos? Superiores\.', re.I)


# Páginas em que o OCR juntou palavras das duas colunas; nelas o corte é feito pelo layout de texto.
LAYOUT_PAGES = {'LDJ': {237}}


def layout_page(pdf, n):
    text = subprocess.run(['pdftotext', '-f', str(n), '-l', str(n), '-layout', str(pdf), '-'],
                          capture_output=True, text=True, check=True).stdout
    lines = [l for l in text.split('\n') if l.strip()]
    width = max(len(l) for l in lines)
    gutter = max(range(width // 3, 2 * width // 3),
                 key=lambda c: sum(1 for l in lines if l[c:c + 2] in ('  ', ' ', '')))
    left = [l[:gutter].strip() for l in lines]
    right = [l[gutter:].strip() for l in lines]
    return '\n'.join(t for t in left + right if t)


def pdf_pages(pdf, layout_pages=()):
    """Texto de cada página em ordem de leitura de duas colunas (esquerda inteira, depois direita)."""
    xml = subprocess.run(['pdftotext', '-bbox-layout', str(pdf), '-'], capture_output=True, text=True, check=True).stdout
    pages = []
    for page in re.finditer(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', xml, re.S):
        width = float(page.group(1))
        cols = ([], [])
        for line in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)"[^>]*>(.*?)</line>', page.group(3), re.S):
            words = re.findall(r'<word[^>]*>(.*?)</word>', line.group(4), re.S)
            text = html.unescape(' '.join(words)).strip()
            if text:
                x, y = float(line.group(1)), float(line.group(2))
                cols[0 if x < width * 0.47 else 1].append((y, x, text))
        pages.append('\n'.join(t for col in cols for _, _, t in sorted(col)))
    for n in layout_pages:
        pages[n - 1] = layout_page(pdf, n)
    return pages


def norm_field(name):
    n = name.lower()
    if n.startswith(('tempo', 'casting')):
        return 'casting_time'
    if n.startswith(('alcance', 'range')):
        return 'range'
    if n.startswith('compon'):
        return 'components'
    return 'duration'


def level_of(line):
    m = LEVEL_RE.match(line)
    if m:
        d = OCR_DIGIT.get(m.group(1), m.group(1))
        return int(d), m.group(2).lower(), bool(m.group(3))
    m = CANTRIP_RE.match(line) or CANTRIP_REV_RE.match(line)
    if m:
        return 0, m.group(1).lower(), bool(m.group(2))
    return None


def join_lines(lines):
    """Junta linhas em parágrafos. Retorna lista de parágrafos (texto puro)."""
    if not lines:
        return []
    widths = sorted(len(l) for l in lines)
    typical = widths[int(len(widths) * 0.75)] if widths else 60
    paras, cur = [], ''
    for i, line in enumerate(lines):
        starts_new = cur and (HIGHER_RE.match(line) or (SUBHEAD_RE.match(line) and re.search(r'[.:!?]$', cur)))
        if starts_new:
            paras.append(cur)
            cur = ''
        if not cur:
            cur = line
        elif cur.endswith('­'):
            cur = cur[:-1] + line
        elif cur.endswith('-') and line[:1].islower():
            cur = cur + line
        else:
            cur = cur + ' ' + line
        nxt = lines[i + 1] if i + 1 < len(lines) else None
        if nxt is not None and re.search(r'[.!?:]$', line) and len(line) < typical * 0.85 and nxt[:1].isupper():
            paras.append(cur)
            cur = ''
    if cur:
        paras.append(cur)
    return [re.sub(r'\s+', ' ', p.replace('­', '')).strip() for p in paras]


def extract_book(pdf, abbr, offset):
    pages = pdf_pages(pdf, LAYOUT_PAGES.get(abbr, ()))
    lines = []  # (pdf_page, texto)
    for pi, page in enumerate(pages):
        for raw in page.split('\n'):
            t = raw.strip()
            if t and not JUNK_RE.match(t):
                lines.append((pi + 1, t))

    starts = []
    for i, (_, t) in enumerate(lines):
        lv = level_of(t)
        if lv and i + 1 < len(lines) and any(FIELD_RE.match(lines[j][1]) for j in range(i + 1, min(i + 4, len(lines)))):
            starts.append((i, lv))

    spells = []
    for n, (i, (level, school, ritual)) in enumerate(starts):
        name_idx = i - 1
        while name_idx > 0 and not re.search(r'[A-Za-zÀ-ú]{2}', lines[name_idx][1]):
            name_idx -= 1  # o OCR às vezes deixa "°" ou "!" sozinhos entre o nome e o círculo
        end = starts[n + 1][0] - 1 if n + 1 < len(starts) else min(len(lines), i + 120)
        fields, cur, j = {}, None, i + 1
        while j < end:
            t = lines[j][1]
            m = FIELD_RE.match(t)
            if m:
                cur = norm_field(m.group(1))
                fields[cur] = m.group(2).strip()
            elif cur and cur != 'duration' and 'duration' not in fields:
                fields[cur] = (fields[cur] + ' ' + t).strip()
            elif 'duration' in fields:
                break
            j += 1
        body = [t for _, t in lines[j:end]]
        spells.append({
            'book': abbr,
            'pdf_page': lines[name_idx][0],
            'page': lines[name_idx][0] + offset,
            'name': lines[name_idx][1],
            'level': level,
            'school': school,
            'ritual': ritual,
            'casting_time': fields.get('casting_time'),
            'range': fields.get('range'),
            'components': fields.get('components'),
            'duration': fields.get('duration'),
            'paragraphs': join_lines(body),
        })
    return spells


def main():
    folder, out = Path(sys.argv[1]), Path(sys.argv[2])
    result = []
    for key, (abbr, title, offset) in BOOKS.items():
        pdf = next((p for p in folder.glob('*.pdf') if key in p.name), None)
        if not pdf:
            print(f'! PDF não encontrado: {key}', file=sys.stderr)
            continue
        spells = extract_book(pdf, abbr, offset)
        print(f'{abbr}: {len(spells)} magias', file=sys.stderr)
        result.extend(spells)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
