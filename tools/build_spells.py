"""Monta as magias de data/rules.pt.json e data/rules.en.json.

Entradas: saída de extract_pt_spells.py, o JSON baixado do D&D Beyond (livros que o usuário possui lá)
e o JSON do 5etools (metadados estruturados, classes e texto em inglês dos demais livros).

Uso: python3 tools/build_spells.py <pt_spells.json> <ddb.json> <5etools.json>
"""
import difflib
import html
from collections import Counter
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from html_clean import clean_spell_en  # noqa: E402

EN_OVERRIDES = json.loads((Path(__file__).parent / 'en_overrides.json').read_text())

ROOT = Path(__file__).resolve().parent.parent
OVERRIDES = json.loads((ROOT / 'tools' / 'spell_overrides.json').read_text())
NAMES = json.loads((ROOT / 'tools' / 'names.json').read_text())
# nomes antigos (Galápagos) ainda usados em tabelas de outros livros, para ligar a magia certa
ALIASES = json.loads((ROOT / 'tools' / 'spell_aliases.json').read_text())

PT_BOOK_TO_EN = {'LJF': 'PHB', 'GXF': 'XGE', 'CTCT': 'TCE', 'TDF': 'FTD'}
SOURCES_PT = [
    ('LJF', 'Livro do Jogador'),
    ('GXF', 'Guia de Xanathar para Todas as Coisas'),
    ('CTCT', 'Caldeirão de Tasha para Todas as Coisas'),
    ('TDF', 'Tesouro dos Dragões de Fizban'),
    ('GMF', 'Guia do Mestre'),
    ('GVRR', 'Guia de Van Richten para Ravenloft'),
    ('BGG', 'Bigby Apresenta: A Glória dos Gigantes'),
    ('MPMM', 'Mordenkainen Apresenta: Monstros do Multiverso'),
    ('LDJ', 'Livro do Jogador'),
]
SOURCES_EN = [
    ('PHB', "Player's Handbook"),
    ('XGE', "Xanathar's Guide to Everything"),
    ('TCE', "Tasha's Cauldron of Everything"),
    ('FTD', "Fizban's Treasury of Dragons"),
    ('DMG', "Dungeon Master's Guide"),
    ('VRGR', "Van Richten's Guide to Ravenloft"),
    ('BGG', 'Bigby Presents: Glory of the Giants'),
    ('MPMM', 'Mordenkainen Presents: Monsters of the Multiverse'),
]
OUR_EN_BOOKS = {'PHB', 'XGE', 'TCE', 'FTD'}

SCHOOL_PT = {'A': 'abjuração', 'D': 'adivinhação', 'C': 'conjuração', 'E': 'encantamento', 'V': 'evocação',
             'I': 'ilusão', 'N': 'necromancia', 'T': 'transmutação'}
SCHOOL_EN = {'A': 'abjuration', 'D': 'divination', 'C': 'conjuration', 'E': 'enchantment', 'V': 'evocation',
             'I': 'illusion', 'N': 'necromancy', 'T': 'transmutation'}
SCHOOL_FROM_PT = {'abjuração': 'A', 'adivinhação': 'D', 'conjuração': 'C', 'invocação': 'C', 'encantamento': 'E',
                  'evocação': 'V', 'ilusão': 'I', 'necromancia': 'N', 'transmutação': 'T'}
DAMAGE_PT = {'acid': 'ácido', 'bludgeoning': 'concussão', 'cold': 'frio', 'fire': 'fogo', 'force': 'energia',
             'lightning': 'elétrico', 'necrotic': 'necrótico', 'piercing': 'perfurante', 'poison': 'veneno',
             'psychic': 'psíquico', 'radiant': 'radiante', 'slashing': 'cortante', 'thunder': 'trovejante'}
SAVE_PT = {'strength': 'força', 'dexterity': 'destreza', 'constitution': 'constituição', 'intelligence': 'inteligência',
           'wisdom': 'sabedoria', 'charisma': 'carisma'}
ATTACK = {'R': ('ataque à distância com magia', 'ranged spell attack'), 'M': ('ataque corpo a corpo com magia', 'melee spell attack')}
CLASS_PT = {'Artificer': 'artífice', 'Bard': 'bardo', 'Cleric': 'clérigo', 'Druid': 'druida', 'Paladin': 'paladino',
            'Ranger': 'patrulheiro', 'Sorcerer': 'feiticeiro', 'Warlock': 'bruxo', 'Wizard': 'mago'}


def ascii_fold(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')


def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', ascii_fold(s).replace("'", '').replace('’', '')).strip('-')


# ---------- texto do 5etools ----------

TAG_RE = re.compile(r'\{@(\w+) ([^}]*)\}')


def untag(s):
    def rep(m):
        parts = m.group(2).split('|')
        return parts[0]
    prev = None
    while prev != s:
        prev, s = s, TAG_RE.sub(rep, s)
    return s


def entries_html(entries):
    out = []
    for e in entries:
        if isinstance(e, str):
            out.append(f'<p>{html.escape(untag(e))}</p>')
        elif e.get('type') == 'list':
            out.append('<ul>' + ''.join(f'<li>{entries_html([i])[3:-4] if isinstance(i, str) else entries_html([i])}</li>'
                                        for i in e['items']) + '</ul>')
        elif e.get('type') == 'table':
            head = ''.join(f'<th>{html.escape(untag(str(c)))}</th>' for c in e.get('colLabels', []))
            rows = ''.join('<tr>' + ''.join(f'<td>{html.escape(untag(str(c if not isinstance(c, dict) else c.get("roll", {}).get("exact", c))))}</td>'
                                            for c in r) + '</tr>' for r in e['rows'])
            out.append(f'<table><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>')
        elif 'entries' in e:
            inner = entries_html(e['entries'])
            if e.get('name'):
                title = f'<strong><em>{html.escape(untag(e["name"]))}.</em></strong> '
                inner = inner.replace('<p>', '<p>' + title, 1) if inner.startswith('<p>') else f'<p>{title}</p>' + inner
            out.append(inner)
        elif e.get('type') == 'item':
            out.append(f'<p><strong>{html.escape(untag(e.get("name", "")))}</strong> {html.escape(untag(e.get("entry", "")))}</p>')
    return ''.join(out)


def plural(n, word):
    return f'{n} {word}' + ('' if n == 1 else 's')


def range_text_en(r):
    t, d = r.get('type'), r.get('distance', {})
    if t == 'point':
        dt = d.get('type')
        if dt in ('feet', 'miles'):
            return f"{d['amount']} {'feet' if dt == 'feet' else plural(d['amount'], 'mile').split(' ', 1)[1]}"
        return {'self': 'Self', 'touch': 'Touch', 'sight': 'Sight', 'unlimited': 'Unlimited'}.get(dt, 'Special')
    if t in ('radius', 'sphere', 'cone', 'line', 'cube', 'hemisphere', 'emanation', 'cylinder'):
        return f"Self ({d.get('amount')}-foot {t})"
    return 'Special'


def duration_text_en(durations):
    d = durations[0]
    if d['type'] == 'instant':
        return 'Instantaneous'
    if d['type'] == 'permanent':
        return 'Until dispelled'
    if d['type'] == 'timed':
        base = plural(d['duration']['amount'], d['duration']['type'])
        return f'Concentration, up to {base}' if d.get('concentration') else base
    return 'Special'


# ---------- campos em português ----------

def fix_ocr(t):
    t = t.replace('ü', 'o').replace('Ü', 'O')  # o OCR da Galápagos lê "O" como "Ü"
    t = re.sub(r'\bRadar\b', 'Hadar', t)
    t = re.sub(r'(?<![\w])[lI](?=d\d)', '1', t)
    t = re.sub(r'\bUrna\b', 'Uma', t)
    t = re.sub(r'\burna\b', 'uma', t)
    t = re.sub(r'\s+([,.;:])', r'\1', t)
    t = re.sub(r',{2,}', ',', t)
    t = re.sub(r'(\d) °', r'\1°', t)
    t = re.sub(r'\b(\d+) d(\d+)\b', r'\1d\2', t)  # "1 d8"
    return t


def join_split_caps(t, lexicon):
    """Junta a inicial que o OCR separou ("E spírito" -> "Espírito") quando a palavra inteira é mais comum no livro."""
    def fix(m):
        whole = (m.group(1) + m.group(2)).lower()
        return m.group(1) + m.group(2) if lexicon.get(whole, 0) > lexicon.get(m.group(2), 0) else m.group(0)
    return re.sub(r'(?<![\w&])([A-ZÀ-Ú]) ([a-zà-úç]+)', fix, t)


SUBHEAD = re.compile(r'^((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wà-úç\'’-]*)(?:\s+[\wà-úç\'’-]+){0,5})\.\s')


def paragraphs_html(paras, lexicon=None):
    out, items = [], []

    def flush():
        if items:
            out.append('<ul>' + ''.join(f'<li>{html.escape(i)}</li>' for i in items) + '</ul>')
            items.clear()

    for raw in paras:
        raw = join_split_caps(fix_ocr(raw), lexicon or {})
        # itens com marcador ("• ...") viram lista, como no texto em inglês
        head, *bullets = re.split(r'\s*•\s*', raw)
        if head.strip():
            flush()
            out.append(paragraph_html(head.strip(), bool(out)))
        for b in (b.strip() for b in bullets if b.strip()):
            if not items and b.endswith(':'):  # introdução da lista marcada como item no livro
                out.append(paragraph_html(b, True))
            else:
                items.append(b)
    flush()
    return ''.join(out)


def paragraph_html(p, not_first):
    m = re.match(r'^Em (C[ií]rculos?|N[ií]veis) Superiores\.\s*', p)
    if m:
        label = 'Em Níveis Superiores.' if m.group(1).lower().startswith('n') else 'Em Círculos Superiores.'
        return f'<p><strong><em>{label}</em></strong> {html.escape(p[m.end():])}</p>'
    m = SUBHEAD.match(p) if not_first else None  # o primeiro parágrafo nunca é subtítulo
    if m and len(m.group(1)) <= 40:
        return f'<p><strong>{html.escape(m.group(1))}.</strong> {html.escape(p[m.end():])}</p>'
    return f'<p>{html.escape(p)}</p>'


def parse_casting_pt(t):
    t = fix_ocr(t or '').strip()
    m = re.match(r'^(\d+)\s+(ação bônus|ação|reação|minutos?|horas?)\s*(?:,\s*(.*))?$', t, re.I)
    if not m:
        return None, 'especial', None, t
    unit = m.group(2).lower()
    unit = 'minutos' if unit.startswith('minuto') else 'horas' if unit.startswith('hora') else unit
    return int(m.group(1)), unit, m.group(3), t


def parse_range_pt(t):
    t = fix_ocr(t or '').strip().rstrip('.')
    low = t.lower()
    for key, unit in (('pessoal', 'pessoal'), ('toque', 'toque'), ('vis', 'visão'), ('ilimit', 'ilimitado'), ('especial', 'especial')):
        if low.startswith(key):
            return None, unit, t
    m = re.match(r'^([\d.,]+)\s*(metros?|m\b|quil[ôo]metros?|km)', low)
    if m:
        value = float(m.group(1).replace('.', '').replace(',', '.')) if 'met' in m.group(2) or m.group(2) == 'm' else float(m.group(1).replace(',', '.'))
        unit = 'metros' if m.group(2).startswith('m') and not m.group(2).startswith('mil') else 'quilômetros'
        if m.group(2).startswith('quil') or m.group(2) == 'km':
            unit = 'quilômetros'
        return value, unit, t
    return None, 'especial', t


def parse_duration_pt(t):
    t = fix_ocr(t or '').strip().rstrip('.')
    low = t.lower()
    conc = low.startswith('conc')
    if 'instant' in low:
        return None, 'instantânea', conc, t
    if 'dissip' in low:
        return None, 'até ser dissipada', conc, t
    if 'especial' in low:
        return None, 'especial', conc, t
    m = re.search(r'(\d+)\s*(rodadas?|minutos?|horas?|dias?)', low)
    if m:
        u = m.group(2)
        unit = 'rodadas' if u.startswith('rod') else 'minutos' if u.startswith('min') else 'horas' if u.startswith('hor') else 'dias'
        return int(m.group(1)), unit, conc, t
    return None, 'especial', conc, t


def parse_components_pt(t):
    t = fix_ocr(t or '')
    head, _, rest = t.partition('(')
    material = rest.rsplit(')', 1)[0].strip() if rest else None
    cost = None
    if material:
        m = re.search(r'(\d[\d.]*)\s*PO\b', material)
        cost = f'{m.group(1)} PO' if m and re.search(r'(valend|valor|vale|custo|custa)', material) else None
    consumed = bool(material and re.search(r'consum', material))
    return 'V' in head, 'S' in head, material, cost, consumed, t


def pt_name(raw, en_name, book, lexicon):
    fixed = OVERRIDES['pt_names'].get(f'{book}|{en_name}')
    if fixed:
        name = fixed
    else:
        name = fix_ocr(re.sub(r'\s+', ' ', raw)).strip(' ^')
        name = re.sub(r'\b([A-ZÀ-Ú]) (?=[a-zà-ú])', r'\1', name)  # "I nvocar A berração"
        name = re.sub(r'\bi (?=[a-zà-ú])', 'i', name)  # "i nvocar" ("i" sozinho não é palavra)
        name = re.sub(r'\s*-\s*', '-', name).lower()
        words = name.split(' ')
        joined = []
        for w in words:
            if joined and (joined[-1] + w) in lexicon and (joined[-1] not in lexicon or w not in lexicon):
                joined[-1] += w
            else:
                joined.append(w)
        name = ' '.join(joined)
    name = name.lower()
    en_words = re.findall(r"[A-Z][\w'’-]+", en_name)
    proper = {ascii_fold(re.sub(r"['’]s$", '', w)) for i, w in enumerate(en_words)
              if re.search(r"['’]s$", w) or (i > 0 and ascii_fold(w) not in lexicon)}
    words = name.split(' ')
    return ' '.join(w.capitalize() if ascii_fold(w) in proper else w for w in words)


# ---------- casamento pt ↔ en ----------

def en_signature(e):
    comp = e.get('components', {})
    rng = e['range']
    dist = rng.get('distance', {})
    if rng.get('type') == 'point':
        r = dist.get('amount') if dist.get('type') == 'feet' else dist.get('type')
    elif rng.get('type') in ('radius', 'sphere', 'cone', 'line', 'cube', 'hemisphere', 'emanation', 'cylinder'):
        r = 'self'
    else:
        r = rng.get('type')
    d = e['duration'][0]
    dur = (d['duration']['amount'], d['duration']['type']) if d['type'] == 'timed' else d['type']
    return dict(level=e['level'], school=e['school'], v=bool(comp.get('v')), s=bool(comp.get('s')), m=bool(comp.get('m')),
                conc=any(x.get('concentration') for x in e['duration']), rit=bool(e.get('meta', {}).get('ritual')),
                unit=e['time'][0]['unit'], rng=r, dur=dur, name=ascii_fold(e['name']).replace(' ', ''),
                dice=set(re.findall(r'\b\d+d\d+\b', json.dumps(e.get('entries', [])) + json.dumps(e.get('entriesHigherLevel', [])))),
                dmg=set(e.get('damageInflict', [])))


def pt_signature(s):
    head = (s['components'] or '').split('(')[0]
    ct = (s['casting_time'] or '').lower()
    unit = 'bonus' if 'bônus' in ct else 'reaction' if 'reaç' in ct else 'action' if 'ação' in ct or 'action' in ct else \
        'minute' if 'minut' in ct else 'hour' if 'hora' in ct else '?'
    value, runit, _ = parse_range_pt(s['range'])
    rng = {'pessoal': 'self', 'toque': 'touch', 'visão': 'sight', 'ilimitado': 'unlimited', 'especial': 'special'}.get(runit)
    if rng is None:
        rng = round(value / 1.5 * 5) if runit == 'metros' and value else 'miles'
    dvalue, dunit, conc, _ = parse_duration_pt(s['duration'])
    dur = {'instantânea': 'instant', 'até ser dissipada': 'permanent', 'especial': 'special'}.get(dunit) or \
        (dvalue, {'rodadas': 'round', 'minutos': 'minute', 'horas': 'hour', 'dias': 'day'}[dunit])
    text = fix_ocr(' '.join(s['paragraphs']))
    dmg = {en for en, pt in DAMAGE_PT.items() if re.search(rf'dano\s+(?:de\s+)?{pt}', text, re.I)}
    return dict(level=s['level'], school=SCHOOL_FROM_PT[s['school']], v='V' in head, s='S' in head, m='M' in head,
                conc=conc, rit=s['ritual'], unit=unit, rng=rng, dur=dur, name=ascii_fold(s['name']).replace(' ', ''),
                dice=set(re.findall(r'\b\d+d\d+\b', text + ' ' + fix_ocr(s['components'] or ''))), dmg=dmg)


WEIGHTS = dict(level=8, school=4, v=1, s=1, m=1, conc=2, rit=2, unit=2, rng=3, dur=2)


def score(a, b):
    sc = sum(w if a[k] == b[k] else -w for k, w in WEIGHTS.items())
    for key, w in (('dice', 6), ('dmg', 4)):
        if a[key] or b[key]:
            sc += w * len(a[key] & b[key]) / len(a[key] | b[key]) - 1
    return sc + 6 * difflib.SequenceMatcher(None, a['name'], b['name']).ratio()


def match_book(pt_list, en_list, book):
    forced = {k.split('|', 1)[1]: v for k, v in OVERRIDES['matches'].items() if k.startswith(book + '|')}
    pairs = {}
    en_by_name = {e['name']: e for e in en_list}
    rest_pt = [s for s in pt_list if s['name'] not in forced]
    used = {forced[s['name']] for s in pt_list if s['name'] in forced}
    for s in pt_list:
        if s['name'] in forced:
            pairs[id(s)] = en_by_name[forced[s['name']]]
    rest_en = [e for e in en_list if e['name'] not in used]
    fp = [pt_signature(s) for s in rest_pt]
    fe = [en_signature(e) for e in rest_en]
    cand = sorted(((score(a, b), i, j) for i, a in enumerate(fp) for j, b in enumerate(fe)), reverse=True)
    ui, uj = set(), set()
    for _, i, j in cand:
        if i not in ui and j not in uj:
            ui.add(i)
            uj.add(j)
            pairs[id(rest_pt[i])] = rest_en[j]
    return pairs


# ---------- montagem ----------

def classes_of(sources, name, book):
    info = sources.get(book, {}).get(name, {})
    core = sorted({c['name'] for c in info.get('class', []) if c['source'] in OUR_EN_BOOKS | {'TCE'}})
    optional = sorted({c['name'] for c in info.get('classVariant', []) if c.get('definedInSource') in OUR_EN_BOOKS})
    return core, [c for c in optional if c not in core]


def ddb_index(ddb):
    out = {}
    for s in ddb['spells']:
        out[s['name']] = s
    return out


def ddb_slug(s):
    return re.sub(r'^/spells/\d+-', '', s['href'])


def strip_ddb_desc(h):
    h = re.sub(r'\s*<span class="components-blurb">.*?</span>', '', h or '', flags=re.S)
    return re.sub(r'\n\s*', '', h).strip()


def build():
    pt_spells = json.loads(Path(sys.argv[1]).read_text())
    ddb = ddb_index(json.loads(Path(sys.argv[2]).read_text()))
    et = json.loads(Path(sys.argv[3]).read_text())
    en_files = et['files']
    sources = et['sources']

    def en_pool(book):
        if book == 'SCAG':
            return [e for e in en_files['TCE']['spell'] if any(o['source'] == 'SCAG' for o in e.get('otherSources', []))]
        return en_files[book]['spell']

    lexicon = {w for s in pt_spells for p in s['paragraphs'] for w in re.findall(r'\b[a-zà-úç]+', fix_ocr(p))}
    words = Counter(w.lower() for s in pt_spells for p in s['paragraphs'] for w in re.findall(r'\b[^\W\d_]+', fix_ocr(p)))
    spells_pt, spells_en, en_done = [], [], {}
    report = []
    for pt_book, en_book in PT_BOOK_TO_EN.items():
        group = [s for s in pt_spells if s['book'] == pt_book]
        pairs = match_book(group, en_pool(en_book), pt_book)
        for s in group:
            e = pairs.get(id(s))
            if not e:
                report.append(f'sem par: {pt_book} {s["name"]}')
                continue
            fields = OVERRIDES['fields'].get(f'{pt_book}|{s["name"]}', {})
            s = {**s, **fields}
            d = ddb.get(e['name'])
            slug = ddb_slug(d) if d else slugify(e['name'])
            core, optional = classes_of(sources, e['name'], e['source'])
            ct, ct_unit, ct_cond, ct_text = parse_casting_pt(s['casting_time'])
            rng, rng_unit, rng_text = parse_range_pt(s['range'])
            dur, dur_unit, conc, dur_text = parse_duration_pt(s['duration'])
            verbal, somatic, material, cost, consumed, comp_text = parse_components_pt(s['components'])
            meta = dict(
                level=e['level'],
                is_ritual=bool(e.get('meta', {}).get('ritual')),
                does_need_concentration=any(x.get('concentration') for x in e['duration']),
                does_have_verbal_component=bool(e.get('components', {}).get('v')),
                does_have_somatic_component=bool(e.get('components', {}).get('s')),
                can_evolve=bool(e.get('entriesHigherLevel') or e.get('scalingLevelDice')),
                classes=core, optional_classes=optional,
            )
            spells_pt.append(dict(
                slug=slug, name=NAMES['spells'].get(e['name']) or pt_name(s['name'], e['name'], pt_book, lexicon), original_name=e['name'], **meta,
                **({'aliases': ALIASES[e['name']]} if e['name'] in ALIASES else {}),
                spell_school_name=SCHOOL_PT[e['school']],
                casting_time=ct, casting_time_unit=ct_unit, casting_conditions=ct_cond, casting_time_text=ct_text,
                range=rng, range_unit=rng_unit, range_text=rng_text,
                duration=dur, duration_unit=dur_unit, duration_text=dur_text,
                components_text=comp_text, material_component=material, material_component_cost=cost,
                is_material_component_consumed=consumed,
                attack=ATTACK[e['spellAttack'][0]][0] if e.get('spellAttack') else 'nenhum',
                saving_throw=SAVE_PT[e['savingThrow'][0]] if e.get('savingThrow') else 'nenhum',
                damage_type=DAMAGE_PT[e['damageInflict'][0]] if len(e.get('damageInflict', [])) == 1 else
                ('especial' if e.get('damageInflict') else None),
                damage='sim' if e.get('damageInflict') else None,
                heal='sim' if 'HL' in e.get('miscTags', []) else None,
                description=paragraphs_html(s['paragraphs'], words) + s.get('statblock_html', ''),
                sources_rels=[{'source_abbreviation': pt_book, 'page': s['page']}],
            ))
            if en_done.get(slug):
                other = next((o.get('page') for o in e.get('otherSources', []) if o['source'] == en_book), None)
                en_done[slug]['sources_rels'].append({'source_abbreviation': en_book, 'page': other})
                continue
            if d:
                stats = d['stats']
                desc = strip_ddb_desc(d['descHtml'])
                mat = re.sub(r'^\*\s*-\s*\(?|\)?$', '', d.get('material') or '').strip() or None
                comps = stats.get('Components', '').replace('*', '').strip()
                comp_en = f'{comps} ({mat})' if mat else comps
                ct_en, rng_en, dur_en = stats.get('Casting Time'), stats.get('Range/Area'), stats.get('Duration')
            else:
                desc = entries_html(e.get('entries', []))
                if e.get('entriesHigherLevel'):
                    desc += entries_html(e['entriesHigherLevel'])
                m = e.get('components', {}).get('m')
                mat = untag(m if isinstance(m, str) else m.get('text', '')) if m else None
                comp_en = ', '.join(k.upper() for k in ('v', 's', 'm') if e.get('components', {}).get(k)) + (f' ({mat})' if mat else '')
                t = e['time'][0]
                ct_en = plural(t['number'], t['unit'].replace('bonus', 'bonus action')) + (f", {untag(t['condition'])}" if t.get('condition') else '')
                rng_en = range_text_en(e['range'])
                dur_en = duration_text_en(e['duration'])
            rng_obj = e['range']
            rng_unit_en = rng_obj.get('distance', {}).get('type', rng_obj.get('type')) if rng_obj.get('type') == 'point' else 'self'
            dur0 = e['duration'][0]
            en = dict(
                slug=slug, name=e['name'], original_name=None, **meta,
                spell_school_name=SCHOOL_EN[e['school']],
                casting_time=None, casting_time_unit=e['time'][0]['unit'], casting_conditions=None, casting_time_text=ct_en,
                range=None, range_unit=rng_unit_en, range_text=rng_en,
                duration=None, duration_unit=dur0['duration']['type'] if dur0['type'] == 'timed' else dur0['type'],
                duration_text=dur_en, components_text=comp_en, material_component=mat, material_component_cost=None,
                is_material_component_consumed=bool(isinstance(e.get('components', {}).get('m'), dict)
                                                    and e['components']['m'].get('consume')),
                attack=ATTACK[e['spellAttack'][0]][1] if e.get('spellAttack') else 'none',
                saving_throw=e['savingThrow'][0] if e.get('savingThrow') else 'none',
                damage_type=e['damageInflict'][0] if len(e.get('damageInflict', [])) == 1 else
                ('special' if e.get('damageInflict') else None),
                damage='yes' if e.get('damageInflict') else None,
                heal='yes' if 'HL' in e.get('miscTags', []) else None,
                description=clean_spell_en(desc) + EN_OVERRIDES.get(f'spell:{slug}', {}).get('append', ''),
                **({'aliases': ALIASES['_en'][e['name']]} if e['name'] in ALIASES.get('_en', {}) else {}),
                sources_rels=[{'source_abbreviation': en_book, 'page': e.get('page') if en_book != 'SCAG' else None}],
            )
            en_done[slug] = en
            spells_en.append(en)
    return spells_pt, spells_en, report


def duplicates(spells):
    by = {}
    for s in spells:
        by.setdefault(s['slug'], []).append(s)
    return {k: v for k, v in by.items() if len(v) > 1}


KLASS_EN = {'bárbaro': 'barbarian', 'bardo': 'bard', 'bruxo': 'warlock', 'clérigo': 'cleric', 'druida': 'druid',
            'feiticeiro': 'sorcerer', 'guerreiro': 'fighter', 'ladino': 'rogue', 'mago': 'wizard', 'monge': 'monk',
            'paladino': 'paladin', 'patrulheiro': 'ranger'}


def assemble(spells, lang, legacy, sources):
    """Interino: classes, subclasses e espécies ainda vêm da base antiga do SRD, com as listas refeitas."""
    d = json.loads(json.dumps(legacy))
    by_slug = {}
    for s in spells:
        by_slug.setdefault(s['slug'], s['name'])
    legacy_slug = {s['name']: s['slug'] for s in legacy['spells']}
    en_class = {v: k for k, v in CLASS_PT.items()}
    to_en = (lambda n: KLASS_EN.get(n, n)) if lang == 'en' else (lambda n: n)
    for lst in d['spell_lists']:
        cls = en_class.get(lst['name'])
        if cls:
            lst['spells_names'] = [s['name'] for s in spells if cls in s['classes'] + s['optional_classes']]
        else:
            lst['spells_names'] = [by_slug[legacy_slug[n]] for n in lst['spells_names'] if legacy_slug.get(n) in by_slug]
        lst['name'] = to_en(lst['name'])
        lst['origin_name'] = to_en(lst['origin_name']) if lst['origin_name'] else None
    for ls in d['level_spells']:
        if ls['spell_name']:
            ls['spell_name'] = by_slug.get(legacy_slug.get(ls['spell_name']), ls['spell_name'])
        ls['spell_list_name'] = to_en(ls['spell_list_name'])
        ls['origin_name'] = to_en(ls['origin_name']) if ls['origin_name'] else None
    for k in d['klasses']:
        k['name'] = to_en(k['name'])
        k['spell_list_name'] = to_en(k['spell_list_name']) if k['spell_list_name'] else None
    for sp in d['specializations']:
        sp['klass_name'] = to_en(sp['klass_name'])
    if lang == 'en':
        for a in d['abilities']:
            a['name'] = a.get('original_name') or a['name']
    d['spells'] = spells
    d['sources'] = [{'abbreviation': a, 'name': n} for a, n in sources]
    d['spell_schools'] = [{'name': n} for n in sorted({s['spell_school_name'] for s in spells})]
    return d


def resolve_duplicates(spells):
    """Mantém a versão escolhida pelo usuário; os outros livros entram como fontes adicionais."""
    chosen = OVERRIDES.get('duplicates', {})
    keep = []
    for s in spells:
        book = s['sources_rels'][0]['source_abbreviation']
        if s['slug'] in chosen and chosen[s['slug']] != book:
            continue
        keep.append(s)
    by_slug = {s['slug']: s for s in keep}
    for s in spells:
        if s['slug'] in chosen and s not in keep:
            by_slug[s['slug']]['sources_rels'].extend(s['sources_rels'])
    return keep


def unique_slugs(spells):
    """Duplicatas ainda sem escolha: a segunda versão ganha um sufixo com a sigla do livro."""
    seen = set()
    for s in spells:
        if s['slug'] in seen:
            s['slug'] = f"{s['slug']}-{s['sources_rels'][0]['source_abbreviation'].lower()}"
        seen.add(s['slug'])


def main():
    spells_pt, spells_en, report = build()
    dups = {k: v for k, v in duplicates(spells_pt).items() if k not in OVERRIDES.get('duplicates', {})}
    spells_pt = resolve_duplicates(spells_pt)
    unique_slugs(spells_pt)
    legacy = json.loads((ROOT / 'data' / 'build' / 'legacy-srd.pt.json').read_text())
    for lang, spells, sources in (('pt', spells_pt, SOURCES_PT), ('en', spells_en, SOURCES_EN)):
        (ROOT / 'data' / f'rules.{lang}.json').write_text(
            json.dumps(assemble(spells, lang, legacy, sources), ensure_ascii=False, separators=(',', ':')))
    out = ROOT / 'data' / 'build'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'spells.pt.json').write_text(json.dumps(spells_pt, ensure_ascii=False, indent=1))
    (out / 'spells.en.json').write_text(json.dumps(spells_en, ensure_ascii=False, indent=1))
    (out / 'duplicates.json').write_text(json.dumps(
        {k: [{'name': s['name'], 'source': s['sources_rels']} for s in v] for k, v in dups.items()}, ensure_ascii=False, indent=1))
    print(f'pt: {len(spells_pt)} | en: {len(spells_en)} | duplicadas: {len(dups)}')
    for line in report:
        print(line)


if __name__ == '__main__':
    main()
