"""Gera data/species/<espécie>.json e o resumo de espécies em rules.<idioma>.json.

Entradas: extração revisada em data/build/species/*.json e o esqueleto em inglês (5etools).
Uso: python3 tools/build_species.py <pasta-species_en>
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from html_clean import normalize_en  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OVERRIDES_PATH = ROOT / 'tools' / 'species_overrides.json'
OVERRIDES = json.loads(OVERRIDES_PATH.read_text()) if OVERRIDES_PATH.exists() else {}
NAMES = json.loads((ROOT / 'tools' / 'names.json').read_text())
EXCLUDED_BOOKS = set(OVERRIDES.get('exclude_books', []))
EXCLUDED_FILES = set(OVERRIDES.get('exclude_files', []))
REMOVED_SUBRACES = set(OVERRIDES.get('remove_subraces', []))
REMOVED_TRAITS = {'ability-score-increase', 'alignment'}  # aumento flexível e alinhamento removido nas erratas


def rename(text, mapping):
    if not text:
        return text
    return ' '.join(NAMES['word_replacements'].get(w, w) for w in mapping.get(text, text).split(' '))


def clean_species(data):
    """Aplica nomes atualizados e as exclusões pedidas pelo usuário."""
    data['name']['pt'] = rename(NAMES['species'].get(data['name']['en']) or data['name']['pt'], {})
    keep = lambda t: t['key'] not in REMOVED_TRAITS and ((t.get('source') or {}).get('pt') or {}).get('book') not in EXCLUDED_BOOKS
    data['traits'] = [t for t in data.get('traits') or [] if keep(t)]
    subs = []
    for sub in data.get('subraces') or []:
        book = (sub.get('source') or {}).get('pt', {}).get('book')
        if book in EXCLUDED_BOOKS or sub.get('slug') in REMOVED_SUBRACES:
            continue
        sub['name']['pt'] = rename(NAMES['subraces'].get(sub['name'].get('en') or '') or sub['name']['pt'], {})
        sub['traits'] = [t for t in sub.get('traits') or [] if keep(t)]
        subs.append(sub)
    data['subraces'] = subs
    fan = NAMES.get('fan', {})
    slug = data['slug']
    data['name']['pt'] = fan.get('species', {}).get(slug, data['name']['pt'])
    for t in data['traits']:
        t['name']['pt'] = fan.get('traits', {}).get(slug, {}).get(t['key'], t['name']['pt'])
    for sub in subs:
        key = f"{slug}/{sub['slug']}"
        sub['name']['pt'] = fan.get('subraces', {}).get(key, sub['name']['pt'])
        for t in sub['traits']:
            t['name']['pt'] = fan.get('subrace_traits', {}).get(key, {}).get(t['key'], t['name']['pt'])
    data['additional_sources'] = [x for x in data.get('additional_sources') or [] if x['pt']['book'] not in EXCLUDED_BOOKS]
    for item in [data, *subs, *data['traits'], *(t for s in subs for t in s['traits'])]:
        for field in ('html', 'intro_html'):
            if (item.get(field) or {}).get('en'):
                item[field]['en'] = normalize_en(item[field]['en'])
    return data


ABILITY = {'str': 'for', 'dex': 'des', 'con': 'con', 'int': 'int', 'wis': 'sab', 'cha': 'car'}
SIZE = {'T': ('miúdo', 'Tiny'), 'S': ('pequeno', 'Small'), 'M': ('médio', 'Medium'), 'L': ('grande', 'Large')}


def ability_rels(ability):
    """Converte o "ability" do 5etools em [{ability_abbreviation, modifier}]; None = bônus à escolha."""
    rels = []
    for opt in (ability or [])[:1]:
        for k, v in opt.items():
            if k == 'choose':
                for _ in range(v.get('count', 1)):
                    rels.append({'ability_abbreviation': None, 'modifier': v.get('amount', 1)})
            elif k in ABILITY:
                rels.append({'ability_abbreviation': ABILITY[k], 'modifier': v})
    return rels


def speed_m(speed):
    walk = speed.get('walk') if isinstance(speed, dict) else speed
    return {'ft': walk, 'm': round(walk * 0.3, 1) if walk else None} if walk else None


def main():
    skel_dir = Path(sys.argv[1])
    out = ROOT / 'data' / 'species'
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('*.json'):  # remove espécies que deixaram de existir (ex.: excluídas por livro)
        old.unlink()
    groups = {}
    for path in sorted((ROOT / 'data' / 'build' / 'species').glob('*.json')):
        data = json.loads(path.read_text())
        if path.stem.split('-', 1)[1].startswith('_') or data['source']['pt']['book'] in EXCLUDED_BOOKS \
                or path.stem in EXCLUDED_FILES:
            continue
        clean_species(data)
        skel_path = skel_dir / path.name
        skel = json.loads(skel_path.read_text()) if skel_path.exists() else {}
        data['_skel'] = skel
        groups.setdefault(data['slug'], []).append(data)

    summaries = {'pt': [], 'en': []}
    duplicates = {}
    for slug, versions in groups.items():
        chosen = OVERRIDES.get('duplicates', {}).get(slug)
        if len(versions) > 1 and chosen:
            keep = next(v for v in versions if v['source']['pt']['book'] == chosen)
            versions = [keep]
        elif len(versions) > 1:
            duplicates[slug] = [v['source']['pt'] for v in versions]
        main_v = versions[0]
        skel = main_v.pop('_skel')
        for v in versions[1:]:
            v.pop('_skel', None)
        detail = {k: main_v.get(k) for k in ('slug', 'name', 'source', 'intro_html', 'traits', 'subraces', 'spells',
                                             'additional_sources', 'pt_from')}
        detail['size'] = skel.get('size')
        detail['speed'] = speed_m(skel.get('speed', 30))
        if len(versions) > 1:
            detail['versions'] = [{k: v.get(k) for k in ('name', 'source', 'intro_html', 'traits', 'subraces', 'spells')}
                                  for v in versions]
        (out / f'{slug}.json').write_text(json.dumps(detail, ensure_ascii=False, separators=(',', ':')))
        for lang in ('pt', 'en'):
            srcs = [main_v['source']] + main_v.get('additional_sources', [])
            summaries[lang].append({
                'name': main_v['name'][lang] or main_v['name']['pt'],
                'slug': slug,
                'sources_rels': [{'source_abbreviation': s[lang]['book'], 'page': s[lang]['page']} for s in srcs if s.get(lang)],
                'size': [SIZE[x][0 if lang == 'pt' else 1] for x in (detail['size'] or []) if x in SIZE],
                'speed': detail['speed'],
                'subraces': [s['name'][lang] or s['name']['pt'] for s in main_v.get('subraces') or []],
                'spellcasting_ability_abbreviation': None,
                'spell_list_name': None,
            })
    (out / '_rules.json').unlink(missing_ok=True)
    for lang in ('pt', 'en'):
        path = ROOT / 'data' / f'rules.{lang}.json'
        rules = json.loads(path.read_text())
        rules['races'] = sorted(summaries[lang], key=lambda r: r['name'])
        rules['spell_lists'] = [l for l in rules['spell_lists'] if l['name'] not in ('alto elfo', 'tiefling')]
        rules['level_spells'] = []
        path.write_text(json.dumps(rules, ensure_ascii=False, separators=(',', ':')))
    (ROOT / 'data' / 'build' / 'species_duplicates.json').write_text(json.dumps(duplicates, ensure_ascii=False, indent=1))
    print(f'{len(groups)} espécies, {len(duplicates)} duplicadas')
    for slug, srcs in duplicates.items():
        print(f'  duplicada: {slug} → {srcs}')


if __name__ == '__main__':
    main()
