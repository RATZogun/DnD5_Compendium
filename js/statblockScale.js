// Fichas que evoluem com o círculo da magia (invocações) ou com o nível da classe (companheiros):
// as fórmulas do texto viram números para o nível escolhido, como no seletor de nível do 5etools.

const NUM = String.raw`(?<![\dd\uE000\uE001])(\d+)`;
const END = String.raw`(?![\dd\uE000\uE001])`;
const SPELL = String.raw`(?:o |this |the )?(?:círculo d[ae] magia|spell[’']s level|level of the spell)`;
const CLASS = String.raw`(?:seu nível de ([a-zà-ú]+)|your ([a-z]+) level)`;
const MULT = { duas: 2, dois: 2, três: 3, quatro: 4, cinco: 5, two: 2, three: 3, four: 4, five: 5 };
// valor já calculado, guardado fora do texto até o fim para que as regras seguintes não o alterem
const TOKEN = /\uE000(\d+)\uE001/g;

const signed = (n) => (n >= 0 ? `+${n}` : String(n));

// regras na ordem em que devem ser aplicadas; `mk(valor, fórmula)` devolve o marcador do valor calculado
function spellRules(level, mk, base) {
  return [
    // "40 + 10 para cada círculo da magia acima do 5º": o acréscimo vai para todos os valores antes da fórmula
    [
      String.raw`^(.*?)\s*\+ (\d+) (?:para cada círculo d[ae] magia acima do|for each spell level above) (\d+)(?:º|°|st|nd|rd|th)`,
      (m, before, per, printed) =>
        before.replace(new RegExp(NUM + END, 'g'), (n) => mk(Number(n) + per * (level - (base ?? printed)), m)),
    ],
    [
      String.raw`(?:à|a) metade do círculo da magia \(arredondado para baixo\)`,
      (m) => `a ${mk(Math.floor(level / 2), m)}`,
    ],
    [String.raw`half (?:this|the) spell[’']s level \(rounded down\)`, (m) => mk(Math.floor(level / 2), m)],
    [NUM + String.raw` \+ ` + SPELL, (m, n) => mk(Number(n) + level, m)],
    [String.raw`igual ao círculo d[ae] magia`, (m) => `igual a ${mk(level, m)}`],
    [String.raw`equal to the (?:level of the spell|spell[’']s level)`, (m) => `equal to ${mk(level, m)}`],
    [SPELL, (m) => mk(level, m)],
  ];
}

function classRules(level, mk) {
  const pb = Math.ceil(level / 4) + 1;
  return [
    [String.raw`(\d+) \+ \((?:BP|PB) [x×] 2\)`, (m, n) => mk(Number(n) + pb * 2, m)],
    [String.raw`([+-]\d+) (?:mais|plus) (?:BP|PB) [x×] 2`, (m, n) => mk(signed(Number(n) + pb * 2), m)],
    [String.raw`([+-]\d+) (?:mais|plus) (?:BP|PB)\b`, (m, n) => mk(signed(Number(n) + pb), m)],
    [NUM + String.raw` \+ (?:BP|PB)\b`, (m, n) => mk(Number(n) + pb, m)],
    [String.raw`(?:\+|plus|mais) (?:BP|PB)\b`, (m) => `+ ${mk(pb, m)}`],
    [
      String.raw`(duas|dois|três|quatro|cinco|two|three|four|five) (?:vezes|times) ` + CLASS,
      (m, w) => mk(MULT[w] * level, m),
    ],
    [
      String.raw`(igual ao|equal to) ` + CLASS,
      (m, w) => `${w === 'equal to' ? 'equal to' : 'igual a'} ${mk(level, m)}`,
    ],
    [CLASS, (m) => mk(level, m)],
    [String.raw`igual ao seu bônus|equals your bonus`, (m) => mk(`+${pb}`, m)],
  ];
}

function scaleText(text, scaling, level) {
  const vals = [];
  const mk = (value, formula) => {
    vals.push({ value, formula });
    return `\uE000${vals.length - 1}\uE001`;
  };
  const rules = scaling.kind === 'spell' ? spellRules(level, mk, scaling.base) : classRules(level, mk);
  for (const [src, fn] of rules) {
    text = text.replace(new RegExp(src, 'g'), (...args) => fn(...args.slice(0, -2)));
  }
  // soma o que sobrou como "5 + 15" depois das trocas (sem mexer em dados como "1d8 + 3")
  const sum = new RegExp(String.raw`\uE000(\d+)\uE001 \+ (\d+)` + END + '|' + NUM + String.raw` \+ \uE000(\d+)\uE001`);
  let m;
  while ((m = sum.exec(text))) {
    const tok = vals[m[1] ?? m[4]];
    const other = Number(m[2] ?? m[3]);
    text = text.slice(0, m.index) + mk(Number(tok.value) + other, tok.formula) + text.slice(m.index + m[0].length);
  }
  const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return text.replace(
    TOKEN,
    (_, i) => `<span class="sb-scaled" title="${attr(vals[i].formula)}">${vals[i].value}</span>`,
  );
}

function scaleHtml(html, scaling, level) {
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith('<') ? part : scaleText(part, scaling, level)))
    .join('');
}

// tipo de escala da ficha: círculo da magia (o círculo base vem de "acima do 5º") ou nível da classe
export function scalingOf(sb) {
  const text = sb.textContent;
  const printed = text.match(/(?:círculo d[ae] magia acima do|spell level above) (\d+)/);
  if (printed) {
    // o círculo real da magia vale mais que o do texto (o livro em português às vezes traz o círculo errado)
    const base = Number(sb.closest('[data-spell-level]')?.dataset.spellLevel) || Number(printed[1]);
    return { kind: 'spell', base, min: base, max: 9 };
  }
  const klass = text.match(/nível de ([a-zà-ú]+)|your ([a-z]+) level/);
  if (klass || /\b(?:BP|PB)\b/.test(text)) {
    const badge = sb.closest('.feature')?.querySelector('.level-badge')?.textContent.match(/\d+/);
    return { kind: 'class', klass: klass ? klass[1] || klass[2] : '', min: badge ? Number(badge[0]) : 1, max: 20 };
  }
  return null;
}

export function applyScale(sb, scaling, level) {
  sb.querySelectorAll(':scope > [data-orig]').forEach((el) => {
    el.innerHTML = scaleHtml(el.dataset.orig, scaling, level);
  });
}
