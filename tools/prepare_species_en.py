"""Prepara, por espécie, o esqueleto em inglês (5etools + texto do D&D Beyond quando houver).

Uso: python3 tools/prepare_species_en.py <ddb-especies.json> <5etools-especies.json> <pasta-saida>
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_spells import entries_html  # noqa: E402
from prepare_classes_en import clean_ddb_html, norm  # noqa: E402

OWNED_ON_DDB = {'PHB', 'MPMM', 'VRGR'}
OUR_BOOKS = {'PHB', 'XGE', 'TCE', 'SCAG', 'DMG', 'FTD', 'BGG', 'VRGR', 'MPMM', 'MM'}


def slugify(name):
    m = re.match(r'(.+?) \((.+)\)$', name)  # "Gnome (Deep)" → "deep-gnome"
    if m:
        name = f'{m.group(2)} {m.group(1)}'
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def fluff_html(fluffs, name, source):
    f = next((x for x in fluffs if x['name'] == name and x['source'] == source), None)
    return entries_html(f.get('entries', [])) if f else None


def main():
    ddb = json.loads(Path(sys.argv[1]).read_text())
    et = json.loads(Path(sys.argv[2]).read_text())
    out = Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    ddb_by_title = {norm(p['title'] or ''): p for p in ddb.values()}
    index = []
    for r in et['race']:
        slug = slugify(r['name'])
        page = ddb_by_title.get(norm(r['name'])) if r['source'] in OWNED_ON_DDB else None
        if r['source'] == 'PHB' and not page:
            page = ddb_by_title.get(norm(r['name']))
        subs = [s for s in et['subrace'] if s.get('raceName') == r['name'] and s.get('raceSource') == r['source'] and s.get('name') and s['source'] in OUR_BOOKS]
        data = {
            'slug': slug, 'name': r['name'], 'source': r['source'], 'page': r.get('page'),
            'size': r.get('size'), 'speed': r.get('speed'), 'ability': r.get('ability'),
            'darkvision': r.get('darkvision'), 'additional_spells': r.get('additionalSpells'),
            'en_text_from': 'ddb' if page else '5etools',
            'ddb_html': clean_ddb_html(page['html']) if page else None,
            'entries_html': entries_html(r.get('entries', [])),
            'fluff_html': fluff_html(et.get('raceFluff', []), r['name'], r['source']),
            'subraces': [{'name': s['name'], 'source': s['source'], 'page': s.get('page'), 'ability': s.get('ability'),
                          'additional_spells': s.get('additionalSpells'), 'entries_html': entries_html(s.get('entries', []))}
                         for s in subs],
        }
        fname = f"{r['source'].lower()}-{slug}.json"
        (out / fname).write_text(json.dumps(data, ensure_ascii=False, indent=1))
        index.append(f"{fname}: {r['name']} ({r['source']} p.{r.get('page')}) subraces={len(subs)} en={data['en_text_from']}")
    (out / 'INDEX.txt').write_text('\n'.join(index))
    print('\n'.join(index))


if __name__ == '__main__':
    main()
