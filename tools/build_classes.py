"""Gera data/classes/<classe>.json a partir da extração revisada (data/build/classes) e do esqueleto em inglês.

Uso: python3 tools/build_classes.py <pasta-classes_en> <ddb-classes.json>
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_spells import untag  # noqa: E402
from prepare_classes_en import DDB_PAGE, clean_ddb_html, ddb_sections, norm, pick  # noqa: E402

EN_NAME_FIX = {'artificer-spell-list': 'Artificer Spell List', 'artificer-infusions': 'Artificer Infusions',
               'otherworldly-patrons': 'Otherworldly Patrons'}


def fill_missing_en(data, ddb):
    """Completa html.en vazio com o texto do D&D Beyond, procurando pelo título no bloco da classe ou da subclasse."""
    page = ddb.get(DDB_PAGE.get(data['name']['en'], ''))
    if not page:
        return
    blocks, _ = ddb_sections(page['html'])
    everything = [f for v in blocks.values() for f in v]
    if not (data.get('intro_html') or {}).get('en'):
        html_page = page['html']
        start = re.search(r'<h2[^>]*>', html_page)
        table = re.search(r'The [A-Z][a-z]+ Table', html_page)
        end = html_page.rfind('<h', 0, table.start()) if table else -1
        if start and end > start.start():
            intro = re.sub(r'<h[234][^>]*>(.*?)</h[234]>', r'<p><strong>\1</strong></p>', html_page[start.start():end], flags=re.S)
            intro = clean_ddb_html(intro)
            intro = re.sub(r'<strong>\s*(.*?)\s*(?:This doesn.t reflect.*?Learn More)?\s*</strong>', r'<strong>\1</strong>', intro)
            data.setdefault('intro_html', {})['en'] = intro
    targets = [(f, everything) for f in data['features']]
    for sub in data.get('subclasses', []):
        key = next((k for k in blocks if norm(sub['name']['en']) in k or (k and k in norm(sub['name']['en']))), None)
        pool = blocks[key] if key else everything
        for v in [sub] + sub.get('versions', []):
            targets += [(f, pool) for f in v.get('features') or []]
    for f, pool in targets:
        if (f.get('html') or {}).get('en'):
            continue
        name = EN_NAME_FIX.get(f['key']) or f['name'].get('en')
        text = pick(pool, name, set()) if name else None
        if text:
            f['html']['en'] = text
            f['name']['en'] = name

ROOT = Path(__file__).resolve().parent.parent
OVERRIDES = json.loads((ROOT / 'tools' / 'class_overrides.json').read_text())
NAMES = json.loads((ROOT / 'tools' / 'names.json').read_text())


FAN_BOOKS = {'LJF', 'GXF', 'GMF'}


def is_fan(x):
    """Itens já extraídos da tradução de fãs trazem o título do próprio livro."""
    return ((x.get('source') or {}).get('pt') or {}).get('book') in FAN_BOOKS


def apply_fan_names(data):
    """Nomes da tradução de fãs (prioridade sobre os da iccarion), por chave do item."""
    fan = NAMES.get('fan', {})
    slug = data['slug']
    if not is_fan(data):
        data['name']['pt'] = fan.get('classes', {}).get(slug, data['name']['pt'])
        if slug in fan.get('subclass_titles', {}):
            data.setdefault('subclass_title', {})['pt'] = fan['subclass_titles'][slug]
    for f in data['features']:
        if not is_fan(f):
            f['name']['pt'] = fan.get('features', {}).get(slug, {}).get(f['key'], f['name']['pt'])
    for sub in data.get('subclasses', []):
        key = f"{slug}/{sub['slug']}"
        for v in [sub] + sub.get('versions', []):
            if key in fan.get('subclasses', {}) and v.get('name') and not is_fan(v):
                v['name']['pt'] = fan['subclasses'][key]
            for f in v.get('features') or []:
                if not is_fan(f):
                    f['name']['pt'] = fan.get('subclass_features', {}).get(key, {}).get(f['key'], f['name']['pt'])


def apply_names(data):
    en = data['name']['en']
    if not is_fan(data):
        data['name']['pt'] = NAMES['classes'].get(en, data['name']['pt'])
        if NAMES['subclass_titles'].get(en):
            data.setdefault('subclass_title', {})['pt'] = NAMES['subclass_titles'][en]
    for sub in data.get('subclasses', []):
        for v in [sub] + sub.get('versions', []):
            if v.get('name') and not is_fan(v) and NAMES['subclasses'].get(v['name'].get('en') or sub['name']['en']):
                v['name']['pt'] = NAMES['subclasses'][v['name'].get('en') or sub['name']['en']]


EXCLUDED_BOOKS = set(OVERRIDES.get('exclude_books', []))


def drop_excluded(data):
    """Remove subclasses e características vindas de livros que deixaram de ser fonte (ficam só as de outros livros)."""
    book = lambda x: ((x.get('source') or {}).get('pt') or {}).get('book')
    data['features'] = [f for f in data['features'] if book(f) not in EXCLUDED_BOOKS]
    subs = []
    for sub in data.get('subclasses', []):
        if book(sub) in EXCLUDED_BOOKS:
            continue
        sub['features'] = [f for f in sub.get('features') or [] if book(f) not in EXCLUDED_BOOKS]
        sub['additional_sources'] = [x for x in sub.get('additional_sources') or [] if x.get('pt', {}).get('book') not in EXCLUDED_BOOKS]
        subs.append(sub)
    data['subclasses'] = subs


def resolve_duplicates(sub):
    """Aplica a versão escolhida pelo usuário; as outras viram fontes adicionais."""
    chosen = OVERRIDES['subclass_duplicates'].get(sub['slug'])
    versions = sub.get('versions')
    if not chosen or not versions:
        return
    keep = next(v for v in versions if v['source']['pt']['book'] == chosen)
    for k in ('source', 'name', 'intro_html', 'features', 'spells'):
        if k in keep:
            sub[k] = keep[k]
    extra = []
    for v in versions:
        if v is keep:
            continue
        src = json.loads(json.dumps(v['source']))
        en = src.get('en') or {}
        page = OVERRIDES['en_pages'].get(f"{sub['slug']}|{en.get('book')}")
        if page:
            en['page'] = page
        extra.append(src)
    sub['additional_sources'] = extra
    sub.pop('versions')
    sub.pop('duplicate', None)
ORD_EN = {1: '1st', 2: '2nd', 3: '3rd'}


def ordinal(n, lang):
    return f'{n}º' if lang == 'pt' else ORD_EN.get(n, f'{n}th')


def cell(v, lang):
    if isinstance(v, dict):
        t = v.get('type')
        if t == 'bonus':
            return f"+{v['value']}"
        if t == 'bonusSpeed':
            return '–' if not v['value'] else (f"+{v['value'] * 3 // 10} m" if lang == 'pt' else f"+{v['value']} ft.")
        if t == 'dice':
            return ' + '.join(f"{d['number']}d{d['faces']}" for d in v['toRoll'])
        return str(v.get('value', ''))
    if isinstance(v, str):
        s = untag(v)
        m = re.fullmatch(r'(\d)(st|nd|rd|th)', s)
        if m:
            return ordinal(int(m.group(1)), lang)
        if s == 'Unlimited':
            return 'ilimitado' if lang == 'pt' else s
        return s
    return v


def table(skel, labels_pt):
    groups = []
    for g in skel.get('classTableGroups') or []:
        rows = g.get('rows') or g.get('rowsSpellProgression') or []
        cols = [untag(c) for c in g['colLabels']]
        title = untag(g['title']) if g.get('title') else None
        groups.append({
            'title': {'en': title, 'pt': labels_pt.get(title, title)} if title else None,
            'columns': [{'en': c, 'pt': labels_pt.get(c, c)} for c in cols],
            'rows': {lang: [[cell(v, lang) for v in r] for r in rows] for lang in ('pt', 'en')},
        })
    return groups


ABILITY = {'str': 'for', 'dex': 'des', 'con': 'con', 'int': 'int', 'wis': 'sab', 'cha': 'car'}


def caster_levels(skel):
    """Espaços de magia por nível de classe, a partir da tabela da classe."""
    levels = []
    for g in skel.get('classTableGroups') or []:
        if g.get('rowsSpellProgression'):
            for i, row in enumerate(g['rowsSpellProgression']):
                levels += [{'level': i + 1, 'spell_level': s + 1, 'slots': n} for s, n in enumerate(row) if n]
        cols = [untag(c) for c in g['colLabels']]
        if 'Spell Slots' in cols and 'Slot Level' in cols:
            for i, row in enumerate(g['rows']):
                slot = int(re.match(r'\d', untag(row[cols.index('Slot Level')])).group())
                levels.append({'level': i + 1, 'spell_level': slot, 'slots': row[cols.index('Spell Slots')]})
    return levels


def prepared_formula(skel):
    p = skel.get('preparedSpells')
    if not p:
        return None
    f = re.sub(r'<\$level\$>', 'class_lv', p)
    f = re.sub(r'<\$\w+_mod\$>', 'ability_mod', f)
    if '/ 2' in f:
        f = f.replace('class_lv / 2', 'class_lv / 2' + ('.ceil' if skel['name'] == 'Artificer' else '.floor'))
    return f


def summary(data, skel, names):
    """Resumo de conjuração usado pela aba Classes e pelos filtros de magias (por idioma)."""
    feats_en = ' '.join((f.get('html') or {}).get('en') or '' for f in data['features'])
    feat_names = {f['name'].get('en') for f in data['features']}
    levels = caster_levels(skel)
    has_spells = bool(levels)
    cantrips = skel.get('cantripProgression') or []
    known = skel.get('spellsKnownProgression') or []
    sub_levels = [f['level'] for s in data.get('subclasses', []) for f in (s.get('features') or s.get('versions', [{}])[0].get('features', []))]
    out = {}
    for lang in ('pt', 'en'):
        name = data['name'][lang]
        out[lang] = {
            'name': name,
            'slug': data['slug'],
            'hit_die': (skel.get('hd') or {}).get('faces'),
            'sources_rels': [{'source_abbreviation': data['source'][lang]['book'], 'page': data['source'][lang]['page']}],
            'spell_list_name': name if has_spells else None,
            'spellcaster_type_name': data['slug'] if has_spells else None,
            'spellcasting_ability_abbreviation': ABILITY.get(skel.get('spellcastingAbility')),
            'class_levels': [{'level': i + 1, 'cantrips_known': cantrips[i] if i < len(cantrips) else None,
                              'spells_known': known[i] if i < len(known) else None} for i in range(20)],
            'must_learn_spells': bool(known),
            'can_learn_extra_spells': bool(feat_names & {'Magical Secrets', 'Mystic Arcanum'}),
            'must_prepare_spells': bool(skel.get('preparedSpells')),
            'can_cast_cantrips': bool(cantrips),
            'can_cast_rituals': 'Ritual Casting' in feats_en,
            'can_use_magic_focus': has_spells and 'Focus' in feats_en,
            'spec_at_level': min(sub_levels) if sub_levels else None,
            'max_spell_level': 9 if 'Mystic Arcanum' in feat_names else max((l['spell_level'] for l in levels), default=-1),
            'subclass_title': data['subclass_title'][lang],
        }
    caster_type = {'name': data['slug'], 'levels': levels, 'preparable_spells': prepared_formula(skel),
                   'multiclass_factor': None} if has_spells else None
    return out, caster_type


def specializations(data, names_by_slug):
    out = {'pt': [], 'en': []}
    for s in data.get('subclasses', []):
        v = s if not s.get('versions') else s['versions'][0]
        spells = s.get('spells') or v.get('spells') or []
        for lang in ('pt', 'en'):
            spell_names = []
            for row in spells:
                for en_name in row.get('names_en', []):
                    slug = names_by_slug['slug_of_en'].get(en_name.lower())
                    if slug and slug in names_by_slug[lang]:
                        spell_names.append(names_by_slug[lang][slug])
            out[lang].append({
                'name': s['name'][lang], 'slug': s['slug'], 'klass_name': data['name'][lang], 'klass_slug': data['slug'],
                'sources_rels': [{'source_abbreviation': x[lang]['book'], 'page': x[lang]['page']}
                                 for x in [v['source']] + s.get('additional_sources', []) if x.get(lang)],
                'spell_list_name': s['name'][lang] if spell_names else None,
                'spells_names': spell_names,
            })
    return out


def update_rules(summaries, types, specs):
    for lang in ('pt', 'en'):
        path = ROOT / 'data' / f'rules.{lang}.json'
        rules = json.loads(path.read_text())
        klasses = sorted((s[lang] for s in summaries), key=lambda k: k['name'])
        subs = [x for sp in specs for x in sp[lang]]
        lists = [l for l in rules['spell_lists'] if l['name'] in {r['spell_list_name'] for r in rules['races'] if r.get('spell_list_name')}]
        en_class = {s['en']['slug']: s['en']['name'] for s in summaries}
        for k in klasses:
            if k['spell_list_name']:
                lists.append({'name': k['spell_list_name'], 'origin_name': None, 'level_spells_names': [],
                              'spells_names': [sp['name'] for sp in rules['spells']
                                               if en_class[k['slug']] in sp['classes'] + sp['optional_classes']]})
        for sp in subs:
            if sp['spell_list_name']:
                lists.append({'name': sp['spell_list_name'], 'origin_name': None, 'level_spells_names': [],
                              'spells_names': sp.pop('spells_names')})
            else:
                sp.pop('spells_names')
        rules['klasses'] = klasses
        rules['specializations'] = subs
        rules['spellcaster_types'] = [t for t in types if t]
        rules['spell_lists'] = lists
        rules['level_spells'] = [ls for ls in rules['level_spells'] if any(ls['name'] in l['level_spells_names'] for l in lists)]
        path.write_text(json.dumps(rules, ensure_ascii=False, separators=(',', ':')))


def main():
    skel_dir = Path(sys.argv[1])
    ddb = json.loads(Path(sys.argv[2]).read_text()) if len(sys.argv) > 2 else {}
    out = ROOT / 'data' / 'classes'
    out.mkdir(parents=True, exist_ok=True)
    spells = {lang: json.loads((ROOT / 'data' / f'rules.{lang}.json').read_text())['spells'] for lang in ('pt', 'en')}
    names = {lang: {s['slug']: s['name'] for s in spells[lang]} for lang in spells}
    names['slug_of_en'] = {s['name'].lower(): s['slug'] for s in spells['en']}
    summaries, types, specs = [], [], []
    for path in sorted((ROOT / 'data' / 'build' / 'classes').glob('*.json')):
        data = json.loads(path.read_text())
        skel = json.loads((skel_dir / path.name).read_text())
        fill_missing_en(data, ddb)
        apply_names(data)
        apply_fan_names(data)
        for sub in data.get('subclasses', []):
            resolve_duplicates(sub)
        drop_excluded(data)
        for sub in data.get('subclasses', []):
            if sub.get('versions'):  # duplicata ainda sem escolha: o topo espelha a primeira versão
                first = sub['versions'][0]
                for k in ('source', 'intro_html', 'features', 'spells'):
                    sub.setdefault(k, first.get(k))
        labels_pt = data.get('table_labels', {}).get('pt', {})
        sub_title = data.get('subclass_title') or {'pt': skel.get('subclassTitle'), 'en': skel.get('subclassTitle')}
        by_level = {}
        for f in data['features']:
            if f.get('level') and not f.get('optional') and f['key'] not in ('hit-points', 'proficiencies', 'equipment'):
                by_level.setdefault(f['level'], []).append({'key': f['key'], 'name': f['name']})
        own = {(f['level'], (f['name'].get('en') or '').lower()) for f in data['features'] if f.get('level')}
        for f in skel['features']:
            if re.search(r'feature$', f['name'], re.I) and (f['level'], f['name'].lower()) not in own:
                by_level.setdefault(f['level'], []).append({'key': 'subclasses', 'name': sub_title})
        result = {
            'slug': data['slug'],
            'name': data['name'],
            'source': data['source'],
            'hit_die': (skel.get('hd') or {}).get('faces'),
            'intro_html': data.get('intro_html'),
            'subclass_title': sub_title,
            'table': {'groups': table(skel, labels_pt), 'features_by_level': dict(sorted(by_level.items()))},
            'features': data['features'],
            'subclasses': data.get('subclasses', []),
        }
        (out / path.name).write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
        s, t = summary(data, skel, names)
        summaries.append(s)
        types.append(t)
        specs.append(specializations(data, names))
        print(f"{data['slug']}: {len(data['features'])} características, {len(result['subclasses'])} subclasses")
    update_rules(summaries, types, specs)


if __name__ == '__main__':
    main()
