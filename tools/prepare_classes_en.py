"""Prepara, por classe, o esqueleto em inglês (estrutura do 5etools + texto do D&D Beyond quando houver).

Uso: python3 tools/prepare_classes_en.py <ddb-classes.json> <5etools-classes.json> <pasta-saida>
"""
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_spells import entries_html, untag  # noqa: E402

DDB_PAGE = {'Barbarian': '9-barbarian', 'Bard': '1-bard', 'Cleric': '2-cleric', 'Druid': '3-druid', 'Fighter': '10-fighter',
            'Monk': '11-monk', 'Paladin': '4-paladin', 'Ranger': '5-ranger', 'Rogue': '12-rogue', 'Sorcerer': '6-sorcerer',
            'Warlock': '7-warlock', 'Wizard': '8-wizard', 'Artificer': '252717-artificer'}
OWNED_ON_DDB = {'PHB', 'XGE', 'TCE', 'VRGR'}


def norm(s):
    return re.sub(r'[^a-z0-9]', '', html.unescape(re.sub(r'<[^>]+>', '', s)).lower())


def ddb_sections(page_html):
    """Divide a página em blocos (h2 = subclasse) e características (h4) com o HTML de cada uma."""
    parts = re.split(r'(<h[234][^>]*>.*?</h[234]>)', page_html, flags=re.S)
    blocks = {'__class__': []}
    intros = {}
    current = '__class__'
    title = None
    for part in parts:
        m = re.match(r'<h([234])[^>]*>(.*?)</h\1>', part, re.S)
        if m:
            level, text = m.group(1), html.unescape(re.sub(r'<[^>]+>', ' ', m.group(2)))
            text = re.sub(r'\s+', ' ', re.sub(r'This doesn.t reflect.*|Learn More|Legacy', '', text)).strip()
            if level == '2':
                current = norm(text)
                blocks.setdefault(current, [])
                intros[current] = ''
                title = None
            else:
                title = text
                blocks[current].append([title, ''])
        elif title is not None and blocks[current]:
            blocks[current][-1][1] += part
        elif current in intros:
            intros[current] += part
    return blocks, intros


def clean_ddb_html(h):
    h = re.sub(r'\s+', ' ', h)
    h = re.sub(r'<(/?)(p|ul|ol|li|table|thead|tbody|tr|th|td|em|strong|br)\b[^>]*>', r'<\1\2>', h)
    h = re.sub(r'<(?!/?(p|ul|ol|li|table|thead|tbody|tr|th|td|em|strong|br)\b)[^>]+>', '', h)
    return h.strip()


def pick(features, name, used):
    key = norm(re.sub(r'\s*\(.*\)$', '', name))
    hits = [i for i, (title, _) in enumerate(features) if norm(title) == key]
    for i in hits:
        if i not in used:
            used.add(i)
            return clean_ddb_html(features[i][1])
    return clean_ddb_html(features[hits[0]][1]) if hits else None  # característica repetida em outros níveis


def feature_html(feat):
    entries = [e for e in feat.get('entries', []) if not (isinstance(e, dict) and e.get('type', '').startswith('ref'))]
    return entries_html(entries)


def main():
    ddb = json.loads(Path(sys.argv[1]).read_text())
    et = json.loads(Path(sys.argv[2]).read_text())
    out = Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    for cls in et['class']:
        if 'Sidekick' in cls['name']:
            continue
        name = cls['name']
        blocks, intros = ddb_sections(ddb[DDB_PAGE[name]]['html']) if DDB_PAGE.get(name) in ddb else ({'__class__': []}, {})
        sub_keys = {k for k in blocks for sc in et['subclass'] if sc['className'] == name
                    and (norm(sc['name']) in k or k in norm(sc['name']))}
        blocks['__class__'] = [f for k, v in blocks.items() if k not in sub_keys and k != '__class__' for f in v]
        used = set()
        feats = []
        for f in et['classFeature']:
            if f['className'] != name or f.get('classSource', 'PHB') != cls['source']:
                continue
            text = pick(blocks['__class__'], f['name'], used) if f['source'] in OWNED_ON_DDB else None
            feats.append({'name': f['name'], 'level': f['level'], 'source': f['source'], 'page': f.get('page'),
                          'optional': bool(f.get('isClassFeatureVariant')), 'en_html': text or feature_html(f),
                          'en_text_from': 'ddb' if text else '5etools'})
        for core in ('Hit Points', 'Proficiencies', 'Equipment'):
            text = pick(blocks['__class__'], core, set())
            if text:
                feats.append({'name': core, 'level': 1, 'source': cls['source'], 'page': cls.get('page'), 'optional': False,
                              'core': True, 'en_html': text, 'en_text_from': 'ddb'})
        feats.sort(key=lambda f: (f['level'], not f.get('core'), f['optional']))
        subs = []
        for sc in et['subclass']:
            if sc['className'] != name:
                continue
            block, intro = None, None
            for key in sub_keys:
                if norm(sc['name']) in key or key in norm(sc['name']):
                    block, intro = blocks[key], clean_ddb_html(re.sub(r'<hgroup>.*?</hgroup>|<p><em>[^<]*</em></p>', '', intros.get(key, ''), count=2, flags=re.S))
                    break
            used_s = set()
            sfeats = []
            for f in et['subclassFeature']:
                if f['className'] != name or f['subclassShortName'] != sc['shortName'] or f['subclassSource'] != sc['source']:
                    continue
                if f['name'] == sc['name'] and intro and f['source'] in OWNED_ON_DDB:
                    text = intro  # a característica que leva o nome da subclasse é o texto de abertura dela
                else:
                    text = pick(block, f['name'], used_s) if block and f['source'] in OWNED_ON_DDB else None
                sfeats.append({'name': f['name'], 'level': f['level'], 'source': f['source'], 'page': f.get('page'),
                               'en_html': text or feature_html(f), 'en_text_from': 'ddb' if text else '5etools'})
            sfeats.sort(key=lambda f: f['level'])
            subs.append({'name': sc['name'], 'short_name': sc['shortName'], 'source': sc['source'], 'page': sc.get('page'),
                         'other_sources': sc.get('otherSources', []), 'additional_spells': sc.get('additionalSpells'),
                         'features': sfeats})
        data = {k: cls.get(k) for k in ('name', 'source', 'page', 'hd', 'proficiency', 'startingProficiencies',
                                       'startingEquipment', 'multiclassing', 'classTableGroups', 'casterProgression',
                                       'spellcastingAbility', 'cantripProgression', 'spellsKnownProgression',
                                       'spellsKnownProgressionFixed', 'preparedSpells', 'subclassTitle', 'additionalSpells')}
        data['features'] = feats
        data['subclasses'] = subs
        slug = re.sub(r'[^a-z]', '', name.lower())
        (out / f'{slug}.json').write_text(json.dumps(data, ensure_ascii=False, indent=1))
        n_ddb = sum(f['en_text_from'] == 'ddb' for f in feats) + sum(f['en_text_from'] == 'ddb' for s in subs for f in s['features'])
        n_all = len(feats) + sum(len(s['features']) for s in subs)
        print(f'{name}: {len(feats)} características, {len(subs)} subclasses, texto D&D Beyond {n_ddb}/{n_all}')


if __name__ == '__main__':
    main()
