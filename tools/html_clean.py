"""Normaliza o HTML em inglês (vindo do D&D Beyond / 5etools) para a mesma estrutura do texto em português."""

import re

BLOCK = re.compile(r'<(p|ul|ol|table|div)\b[^>]*>.*?</\1>', re.S)
EMPTY_P = re.compile(r'^<p>\s*</p>$')
# características que são listas de opções em caixas: o nome da opção fica num parágrafo próprio
BOXED_OPTIONS = {'eldritch-invocations', 'eldritch-invocations-extra', 'artificer-infusions'}


def _dot(label):
    label = label.strip()
    return label if label.endswith(('.', ':', '!', '?')) else label + '.'


def tokens(html):
    out, pos = [], 0
    for m in BLOCK.finditer(html):
        gap = html[pos:m.start()].strip()
        if gap:
            out.append(gap)
        out.append(m.group(0))
        pos = m.end()
    if html[pos:].strip():
        out.append(html[pos:].strip())
    return out


def _fix_text(html):
    # listas de opções em <ul><li><p><strong>Nome</strong> ...: viram parágrafos, como no português
    html = re.sub(r'<ul>((?:\s*<li>\s*<p><strong>.*?</p>\s*</li>)+)\s*</ul>',
                  lambda m: re.sub(r'\s*</?li>\s*', '', m.group(1)), html, flags=re.S)
    # "<strong>Nome</strong><br>texto" (5etools) e "<strong>Nome</strong> texto" sem ponto: título com ponto
    html = re.sub(r'<p><strong>([^<]+?)\s*</strong>\s*(?:<br>)\s*', lambda m: f'<p><strong>{_dot(m.group(1))}</strong> ', html)
    html = re.sub(r'<p><strong>([^<]+?)\s*</strong>\s+(?=[A-Z])', lambda m: f'<p><strong>{_dot(m.group(1))}</strong> ', html)
    html = re.sub(r'<strong>([^<]*?)\s+</strong>\s*', r'<strong>\1</strong> ', html)
    # linha "3rd-level X feature" em itálico, como "Característica de X de 3º nível" no português
    html = re.sub(r'<p>(\d+(?:st|nd|rd|th)-level [^<]*?(?:feature|features))\s*(</p>|<br>)', r'<p><em>\1</em>\2', html)
    html = re.sub(r'<em>([^<]*?)\s+</em>', r'<em>\1</em>', html)
    html = re.sub(r'<p>\s+', '<p>', html)
    html = re.sub(r'\s+</p>', '</p>', html)
    html = re.sub(r'(<br>)\s+', r'\1', html)
    html = re.sub(r' {2,}', ' ', html)
    html = re.sub(r'>\s+<(?=/?(?:p|ul|ol|li|table|thead|tbody|tr|th|td|div|caption)\b)', '><', html)
    return html


def normalize_en(html, boxed=False):
    """Subtítulos soltos viram negrito (parágrafo próprio ou início do parágrafo, como no português),
    parágrafos vazios e &nbsp; saem e o espaço dentro do negrito vai para fora."""
    if not html:
        return html
    html = html.replace('&nbsp;', ' ').replace(' ', ' ')
    html = re.sub(r'<p>\s*</p>', '<p></p>', html)
    toks = tokens(html)
    out, i = [], 0
    while i < len(toks):
        tok = toks[i]
        if tok.startswith('<'):
            if not EMPTY_P.match(tok):
                out.append(tok)
            i += 1
            continue
        # texto solto: subtítulo do D&D Beyond
        text = re.sub(r'\s+', ' ', tok).strip()
        j, gap = i + 1, False
        while j < len(toks) and EMPTY_P.match(toks[j]):
            gap, j = True, j + 1
        nxt = toks[j] if j < len(toks) else ''
        if gap and not boxed and nxt.startswith('<p>') and not nxt.startswith('<p><em>'):
            label = text if text.endswith(('.', ':', '!', '?')) else text + '.'
            out.append(f'<p><strong>{label}</strong> {nxt[3:]}')
            i = j + 1
        else:
            out.append(f'<p><strong>{text}</strong></p>')
            i = j
    # as regras abaixo não mexem nas fichas de criatura (<div class="statblock">), que já estão no formato final
    html = ''.join(tok if tok.startswith('<div') else _fix_text(tok) for tok in out)
    return html


HEAD_ONLY = re.compile(r'^<p><strong>([^<]+)</strong></p>$')
RUN_IN = re.compile(r'^<p><strong>([^<]+?)\.</strong>\s*(.+)$', re.S)


def align_style(pt, en):
    """Quando o português usa só um estilo de subtítulo (parágrafo próprio ou início do parágrafo),
    o inglês da mesma característica passa a usar o mesmo."""
    if not pt or not en:
        return en
    pt_toks = tokens(pt)
    # títulos de tabela (seguidos de <table>) não contam como subtítulo
    pt_head = sum(bool(HEAD_ONLY.match(t)) and not (pt_toks[k + 1:k + 2] or [''])[0].startswith('<table')
                  for k, t in enumerate(pt_toks))
    pt_run = sum(bool(RUN_IN.match(t)) for t in pt_toks)
    toks = tokens(en)
    out, i = [], 0
    if pt_run and not pt_head:
        while i < len(toks):
            m = HEAD_ONLY.match(toks[i])
            nxt = toks[i + 1] if i + 1 < len(toks) else ''
            if m and nxt.startswith('<p>') and not nxt.startswith(('<p><em>', '<p><strong>')) and len(m.group(1)) <= 60:
                label = m.group(1).strip()
                label = label if label.endswith(('.', ':', '!', '?')) else label + '.'
                out.append(f'<p><strong>{label}</strong> {nxt[3:]}')
                i += 2
            else:
                out.append(toks[i])
                i += 1
        return ''.join(out)
    if pt_head and not pt_run:
        for tok in toks:
            m = RUN_IN.match(tok)
            if m and len(m.group(1)) <= 60:
                out.append(f'<p><strong>{m.group(1).strip()}</strong></p><p>{m.group(2)}')
            else:
                out.append(tok)
        return ''.join(out)
    return en


def keep_options(html, names):
    """Mantém só as opções (nome em parágrafo próprio) cujo nome está em `names`, mais o texto de abertura."""
    out, keep = [], True
    for tok in tokens(html):
        m = HEAD_ONLY.match(tok)
        if m:
            keep = m.group(1).strip().lower() in names
        if keep:
            out.append(tok)
    return ''.join(out)


XGE_INVOCATIONS = {n.lower() for n in [
    'Aspect of the Moon', 'Cloak of Flies', 'Eldritch Smite', 'Ghostly Gaze', 'Gift of the Depths',
    'Gift of the Ever-Living Ones', 'Grasp of Hadar', 'Improved Pact Weapon', 'Lance of Lethargy', 'Maddening Hex',
    'Relentless Hex', 'Shroud of Shadow', 'Tomb of Levistus', "Trickster's Escape", 'Trickster’s Escape']}
TCE_INVOCATIONS = {n.lower() for n in [
    'Bond of the Talisman', 'Eldritch Mind', 'Far Scribe', 'Gift of the Protectors', 'Investment of the Chain Master',
    'Protection of the Talisman', 'Rebuke of the Talisman', 'Undying Servitude']}


def drop_options(html, labels):
    """Remove parágrafos de opção (título no início) cujo título está em `labels` (ex.: opções de livros excluídos)."""
    return ''.join(tok for tok in tokens(html)
                   if not ((m := RUN_IN.match(tok)) and m.group(1).strip().lower() in labels))


ABIL_BLOCK = re.compile(r'<div class="stat-block-ability-scores">((?:\s*<div class="stat-block-ability-scores-stat">.*?</div>\s*</div>)+)\s*</div>', re.S)
ABIL_STAT = re.compile(r'-heading">\s*(\w+)\s*</div>\s*<div class="stat-block-ability-scores-data">(.*?)</div>', re.S)
DDB_STATBLOCK = re.compile(r'<div class="Basic-Text-Frame stat-block-finder[^"]*">(.*?)</div>', re.S)


def _untag(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s)).strip()


def _ability_table(m):
    stats = ABIL_STAT.findall(m.group(1))
    head = ''.join(f'<th>{h}</th>' for h, _ in stats)
    row = ''.join(f'<td>{_untag(v)}</td>' for _, v in stats)
    return f'<table><thead><tr>{head}</tr></thead><tbody><tr>{row}</tr></tbody></table>'


def _statblock(m):
    parts = re.findall(r'<p(?: class="Stat-Block-Styles_Stat-Block-([\w-]+)")?[^>]*>(.*?)</p>|(<table>.*?</table>)',
                       m.group(1), re.S)
    name = meta = ''
    out, attrs = [], []

    def flush():
        if attrs:
            out.append('<p>' + '<br>'.join(attrs) + '</p>')
            attrs.clear()

    for kind, body, table in parts:
        body = body.strip()
        if table:
            flush()
            out.append(table)
        elif kind == 'Title':
            name = _untag(body)
        elif kind == 'Metadata':
            meta = _untag(body)
        elif kind.startswith('Data'):
            attrs.append(body)
        elif kind == 'Heading':
            flush()
            out.append(f'<p><strong>{_untag(body)}</strong></p>')
        else:
            flush()
            body = re.sub(r'^<em><strong>(.*?)</strong>\s*([^<]+:)</em>', r'<em><strong>\1</strong></em> <em>\2</em>', body)
            out.append(f'<p>{body}</p>')
    flush()
    return f'<div class="statblock"><p><strong>{name}</strong><br><em>{meta}</em></p>' + ''.join(out) + '</div>'


def clean_spell_en(html):
    """Descrição de magia em inglês (D&D Beyond) na mesma estrutura do português."""
    if not html:
        return html
    html = html.replace('&nbsp;', ' ').replace(' ', ' ')
    html = re.sub(r'</?a\b[^>]*>', '', html)
    html = ABIL_BLOCK.sub(_ability_table, html)
    html = DDB_STATBLOCK.sub(_statblock, html)
    html = re.sub(r'<div class="table-overflow-wrapper">(.*?)</div>', r'\1', html, flags=re.S)
    html = re.sub(r'</?span\b[^>]*>', '', html)
    html = re.sub(r'<(p|table|ul|ol|li|td|th|tr)\s+class="[^"]*"', r'<\1', html)
    html = re.sub(r'<(/?)b>', r'<\1strong>', html)
    html = re.sub(r'<h[1-6][^>]*>(.*?)</h[1-6]>', r'<p><strong>\1</strong></p>', html, flags=re.S)
    html = re.sub(r'<p>\s*(?:<(?:em|strong)>\s*)+At Higher Levels\.?\s*(?:</(?:em|strong)>\s*)+',
                  '<p><strong><em>At Higher Levels.</em></strong> ', html)
    html = re.sub(r'<strong>([^<]*?)\s+</strong>\s*', r'<strong>\1</strong> ', html)
    html = re.sub(r'<p>\s*</p>', '', html)
    html = re.sub(r'<p>\s+', '<p>', html)
    html = re.sub(r'\s+</p>', '</p>', html)
    html = re.sub(r' {2,}', ' ', html)
    html = re.sub(r'>\s+<(?=/?(?:p|ul|ol|li|table|thead|tbody|tr|th|td|div|caption)\b)', '><', html)
    return html
