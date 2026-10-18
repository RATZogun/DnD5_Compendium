"""Converte fichas de criatura soltas no HTML (características de classe) para <div class="statblock">."""

import re
ATTR = re.compile(r'^<p><strong>\s*(Classe de Armadura|Pontos de Vida|Deslocamento|Salvaguardas|Testes de Resistência|Perícias|'
                  r'(?:Resistências|Imunidades|Vulnerabilidades) [aà] (?:Danos?|Condiç(?:ão|ões))|Sentidos|Idiomas|Desafio|'
                  r'Armor Class|Hit Points|Speed|Saving Throws|Skills|Damage Resistances|Damage Immunities|Condition Immunities|'
                  r'Damage Vulnerabilities|Senses|Languages|Challenge)\b', re.I)
SUB = re.compile(r'^<p>(?:<strong>)?\s*(Ações Bônus|Ações|Reações|Reação|Bonus Actions|Actions|Reactions|Reaction)\s*(?:</strong>)?</p>$')
TRAIT = re.compile(r'^<p>(<strong><em>|<em><strong>)')
ABIL_EN = re.compile(r'^STR\s+(\S+ \S+)\s+DEX\s+(\S+ \S+)\s+CON\s+(\S+ \S+)\s+INT\s+(\S+ \S+)\s+WIS\s+(\S+ \S+)\s+CHA\s+(\S+ \S+)$')
HEADS = ['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR']
HEADS_EN = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']


def tokens(html):
    out, pos = [], 0
    for m in re.finditer(r'<p>.*?</p>|<table>.*?</table>', html, re.S):
        gap = html[pos:m.start()].strip()
        if gap:
            out.append(gap)
        out.append(m.group(0))
        pos = m.end()
    if html[pos:].strip():
        out.append(html[pos:].strip())
    return [t for t in out if t not in ('<p>&nbsp;</p>',)]


def strip(t):
    return re.sub(r'<[^>]+>', '', t).strip()


def norm_trait(t):
    t = re.sub(r'^<p><strong><em>(.*?)</em></strong>', r'<p><em><strong>\1</strong></em>', t)
    # "<em><strong>Nome.</strong> Arma de...:</em>" -> nome e tipo de ataque separados
    t = re.sub(r'^<p><em><strong>(.*?)</strong>\s*([^<]+:)</em>', r'<p><em><strong>\1</strong></em> <em>\2</em>', t)
    return t


def convert(html, lang):
    toks = tokens(html)
    i = next((k for k, t in enumerate(toks) if ATTR.match(t) and re.search(r'Classe de Armadura|Armor Class', t)), None)
    if i is None or i < 2:
        return html, False
    name, typ = strip(toks[i - 2]), strip(toks[i - 1])
    j, attrs1, table, attrs2, body = i, [], '', [], []
    while j < len(toks) and ATTR.match(toks[j]):
        attrs1.append(re.sub(r'^<p>|</p>$', '', toks[j]).strip()); j += 1
    if j < len(toks) and toks[j].startswith('<table>'):
        cells = re.findall(r'<td>(.*?)</td>', toks[j])
        table, j = cells[-6:], j + 1
    elif j < len(toks) and ABIL_EN.match(re.sub(r'\s+', ' ', toks[j])):
        table, j = list(ABIL_EN.match(re.sub(r'\s+', ' ', toks[j])).groups()), j + 1
    while j < len(toks) and ATTR.match(toks[j]):
        attrs2.append(re.sub(r'^<p>|</p>$', '', toks[j]).strip()); j += 1
    while j < len(toks) and (TRAIT.match(toks[j]) or SUB.match(toks[j])):
        m = SUB.match(toks[j])
        body.append(f'<p><strong>{m.group(1)}</strong></p>' if m else norm_trait(toks[j])); j += 1
    heads = HEADS if lang == 'pt' else HEADS_EN
    block = (f'<div class="statblock"><p><strong>{name}</strong><br><em>{typ}</em></p>'
             f'<p>{"<br>".join(attrs1)}</p>'
             + (f'<table><thead><tr>{"".join(f"<th>{h}</th>" for h in heads)}</tr></thead><tbody><tr>'
                f'{"".join(f"<td>{c}</td>" for c in table)}</tr></tbody></table>' if table else '')
             + (f'<p>{"<br>".join(attrs2)}</p>' if attrs2 else '') + ''.join(body) + '</div>')
    rest, after = convert(''.join(toks[j:]), lang)
    return ''.join(toks[:i - 2]) + block + rest, True




def statblocks(html, lang):
    """Formata a ficha de criatura de um texto, se houver uma ainda sem formatação."""
    if not html or 'class="statblock"' in html or not re.search(r'Classe de Armadura|Armor Class', html):
        return html
    return convert(html, lang)[0]
