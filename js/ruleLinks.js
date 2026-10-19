// Termos de regra citados nos textos (condições, ações, testes, cobertura, visão, luz...) viram links para a ficha
// do Resumo de Regras. Só a primeira ocorrência de cada termo em cada bloco (ficha, característica, seção) ganha
// o link, para o texto não virar um mar de sublinhados.
import { getLang } from './i18n.js';
import { href } from './router.js';

const L = '\\p{L}';
// estados que pedem a condição ("fica caído", "está invisível"), para não confundir com o uso comum da palavra
const STATE_PT =
  '(?:fica|ficam|ficar|ficará|ficarão|fique|fiquem|estiver|estiverem|está|estão|estar|esteja|estará|torna-se|tornar-se|se torna|permanece|será|serão|ser|seja|considerad[oa]s?|condição)';
const STATE_EN =
  '(?:is|are|be|been|being|becomes|become|turns|turn|remain|remains|knocked|knock it|fall|falls|landing|lands|the target|the creature|condition)';

const SKILLS_PT = {
  Atletismo: 'athletics',
  Acrobacia: 'acrobatics',
  Furtividade: 'stealth',
  Prestidigitação: 'sleight-of-hand',
  Arcanismo: 'arcana',
  História: 'history',
  Investigação: 'investigation',
  Natureza: 'nature',
  Religião: 'religion',
  'Adestrar Animais': 'animal-handling',
  'Lidar com Animais': 'animal-handling',
  Intuição: 'insight',
  Medicina: 'medicine',
  Percepção: 'perception',
  Sobrevivência: 'survival',
  Atuação: 'performance',
  Enganação: 'deception',
  Intimidação: 'intimidation',
  Persuasão: 'persuasion',
};
const SKILLS_EN = {
  Athletics: 'athletics',
  Acrobatics: 'acrobatics',
  Stealth: 'stealth',
  'Sleight of Hand': 'sleight-of-hand',
  Arcana: 'arcana',
  History: 'history',
  Investigation: 'investigation',
  Nature: 'nature',
  Religion: 'religion',
  'Animal Handling': 'animal-handling',
  Insight: 'insight',
  Medicine: 'medicine',
  Perception: 'perception',
  Survival: 'survival',
  Performance: 'performance',
  Deception: 'deception',
  Intimidation: 'intimidation',
  Persuasion: 'persuasion',
};
// perícias em qualquer lugar ("Força (Atletismo)", "escolha duas entre História, Intuição..."), mas só com a
// inicial maiúscula, para não pegar "a história do mundo" ou "a natureza"; nomes de características e magias que
// contêm o nome de uma perícia ficam de fora
const SKILL_EXCEPT = {
  'sleight-of-hand': '(?! Arcana)',
  performance: '(?! (?:da|of) )(?<!(?:Enthralling|Animating) Performance)',
};
const skillTerms = (skills) =>
  Object.entries(skills).map(([name, id]) => [`${name}${SKILL_EXCEPT[id] ?? ''}`, id, true]);

// [expressão, id do item]; os mais longos vêm antes dos que eles contêm ("escuridão densa" antes de "escuridão")
const TERMS = {
  pt: [
    ['testes? de resistência', 'saving-throw'],
    ['jogadas? de ataque', 'attack-roll'],
    ['testes? de habilidade', 'ability-check'],
    ['bônus de proficiência', 'proficiency-bonus'],
    ['desvantagem', 'advantage-and-disadvantage'],
    ['vantagem', 'advantage-and-disadvantage'],
    ['resistência(?= (?:a|ao|contra) (?:dano|todo))', 'resistance-and-vulnerability'],
    ['vulnerabilidade', 'resistance-and-vulnerability'],
    ['ataques? de oportunidade', 'opportunity-attack'],
    ['terreno difícil', 'difficult-terrain'],
    ['(?:combate|combater|lutar|luta) com duas armas', 'offhand-attack'],
    ['(?<=(?<![\\p{L}])ação (?:de )?)(?:ataque|atacar)', 'attack'],
    ['(?<=(?<![\\p{L}])ação (?:de )?)disparada', 'dash'],
    ['(?<=(?<![\\p{L}])ação (?:de )?)desengajar', 'disengage'],
    ['(?<=(?<![\\p{L}])ação (?:de )?)esquivar', 'dodge'],
    ['(?<=(?<![\\p{L}])ação (?:de )?)esconder', 'hide'],
    ['(?<=(?<![\\p{L}])ação (?:de )?)ajudar', 'help'],
    ['(?<=(?<![\\p{L}])ação (?:de )?)preparar', 'ready'],
    ['(?<=(?<![\\p{L}])ação (?:de )?)procurar', 'search'],
    ['(?<=(?<![\\p{L}])ação (?:de )?)usar um objeto', 'use-object'],
    ['agarrão', 'grapple'],
    ['encontrão', 'shove'],
    ['amedrontad[oa]s?', 'frightened'],
    ['enfeitiçad[oa]s?', 'charmed'],
    ['atordoad[oa]s?', 'stunned'],
    ['envenenad[oa]s?', 'poisoned'],
    ['incapacitad[oa]s?', 'incapacitated'],
    ['inconscientes?', 'unconscious'],
    ['paralisad[oa]s?', 'paralyzed'],
    ['petrificad[oa]s?', 'petrified'],
    ['surd[oa]s?', 'deafened'],
    ['agarrad[oa]s?', 'grappled'],
    ['impedid[oa]s?(?! (?:de|a|que) )', 'restrained'],
    ['exaustão', 'exhaustion'],
    ['(?<!às )(?<!sentido )ceg[oa]s?', 'blinded'],
    [`(?<=${STATE_PT} )(?:caíd|derrubad)[oa]s?`, 'prone'],
    [`(?<=${STATE_PT} )invisíve(?:l|is)`, 'invisible'],
    ['meia cobertura', 'half-cover'],
    ['(?:três[ -]quartos de cobertura|cobertura de três[ -]quartos)', 'three-quarters-cover'],
    ['cobertura total', 'full-cover'],
    ['visão no escuro', 'darkvision'],
    ['(?:percepção|visão) às cegas', 'blindsight'],
    ['visão verdadeira', 'truesight'],
    ['(?:escuridão densa|(?:densamente|fortemente) obscurecid[oa]s?)', 'heavily-obscured'],
    ['(?:escuridão leve|levemente obscurecid[oa]s?)', 'lightly-obscured'],
    ['penumbra', 'dim-light'],
    ['(?:luz fraca|meia-luz)', 'dim-light'],
    ['luz (?:plena|brilhante)', 'bright-light'],
    ['escuridão', 'darkness'],
    ['dano de queda', 'falling'],
    // por último: os termos mais longos que contêm um nome de perícia ("percepção às cegas") vêm antes
    ...skillTerms(SKILLS_PT),
  ],
  en: [
    ['saving throws?', 'saving-throw'],
    ['attack rolls?', 'attack-roll'],
    ['ability checks?', 'ability-check'],
    ['proficiency bonus', 'proficiency-bonus'],
    ['disadvantage', 'advantage-and-disadvantage'],
    ['advantage', 'advantage-and-disadvantage'],
    ['resistance(?= to )', 'resistance-and-vulnerability'],
    ['vulnerability', 'resistance-and-vulnerability'],
    ['opportunity attacks?', 'opportunity-attack'],
    ['difficult terrain', 'difficult-terrain'],
    ['two-weapon fighting', 'offhand-attack'],
    ['attack(?= action)', 'attack'],
    ['dash(?= action)', 'dash'],
    ['disengage(?= action)', 'disengage'],
    ['dodge(?= action)', 'dodge'],
    ['hide(?= action)', 'hide'],
    ['help(?= action)', 'help'],
    ['ready(?= action)', 'ready'],
    ['search(?= action)', 'search'],
    ['use an object(?= action)', 'use-object'],
    ['frightened', 'frightened'],
    ['charmed', 'charmed'],
    ['stunned', 'stunned'],
    ['poisoned', 'poisoned'],
    ['incapacitated', 'incapacitated'],
    ['unconscious', 'unconscious'],
    ['paralyzed', 'paralyzed'],
    ['petrified', 'petrified'],
    ['deafened', 'deafened'],
    ['grappled', 'grappled'],
    ['restrained', 'restrained'],
    ['exhaustion', 'exhaustion'],
    ['blinded', 'blinded'],
    [`(?<=${STATE_EN} )prone`, 'prone'],
    [`(?<=${STATE_EN} )invisible`, 'invisible'],
    ['half cover', 'half-cover'],
    ['three-quarters cover', 'three-quarters-cover'],
    ['total cover', 'full-cover'],
    ['darkvision', 'darkvision'],
    ['blindsight', 'blindsight'],
    ['truesight', 'truesight'],
    ['heavily obscured', 'heavily-obscured'],
    ['lightly obscured', 'lightly-obscured'],
    ['dim light', 'dim-light'],
    ['bright light', 'bright-light'],
    ['darkness', 'darkness'],
    ['falling damage', 'falling'],
    // por último: os termos mais longos que contêm um nome de perícia ("percepção às cegas") vêm antes
    ...skillTerms(SKILLS_EN),
  ],
};

// uma expressão só por idioma, com um grupo por termo (o índice do grupo diz o item)
const compiled = {};
function matcher(lang) {
  if (!compiled[lang]) {
    const list = TERMS[lang] ?? TERMS.pt;
    const source = list.map(([re]) => `(?<![${L}])(${re})(?![${L}])`).join('|');
    compiled[lang] = {
      re: new RegExp(source, 'giu'),
      ids: list.map(([, id]) => id),
      cased: list.map(([, , c]) => !!c),
    };
  }
  return compiled[lang];
}

// fora de links, títulos, botões, cabeçalhos de ficha e campos de formulário
const SKIP =
  'a, button, h1, h2, h3, h4, h5, h6, summary, th, dt, .sp-head, .sp-grid, label, select, textarea, input, code';
const BLOCK = 'article, details, section, .feature';

// perícia de verdade: com inicial maiúscula e fora de nomes próprios ("Domínio da Natureza", "Elmo da Percepção",
// "Power of Nature", "Furtividade Sombria", "Nature Domain")
function skillHere(text, m) {
  if (m[0][0] !== m[0][0].toUpperCase()) return false;
  const before = text.slice(Math.max(0, m.index - 30), m.index);
  const after = text.slice(m.index + m[0].length);
  // "Teste de Percepção" e "CD de Furtividade" são a perícia; "Domínio da Natureza", não
  const properName =
    /\p{Lu}\p{L}* (?:d[aoe]s?|of) $/u.test(before) && !/(?:Testes?|CD|Check|DC) (?:d[aoe]|of) $/u.test(before);
  return !properName && !/^(?: \p{Lu}|['’]s)/u.test(after);
}

export function linkRules(root) {
  if (!root) return;
  const { re, ids, cased } = matcher(getLang());
  const seen = new WeakMap();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.nodeValue.trim().length > 2 && !n.parentElement?.closest(SKIP)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const block = node.parentElement.closest(BLOCK) ?? root;
    if (!seen.has(block)) seen.set(block, new Set());
    const used = seen.get(block);
    const text = node.nodeValue;
    const parts = [];
    let last = 0;
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const k = m.slice(1).findIndex((g) => g !== undefined);
      const id = ids[k];
      if (used.has(id) || (cased[k] && !skillHere(text, m))) continue;
      used.add(id);
      parts.push(text.slice(last, m.index));
      const a = document.createElement('a');
      a.className = 'rule-link';
      a.href = href.rule(id);
      a.textContent = m[0];
      parts.push(a);
      last = m.index + m[0].length;
    }
    if (!parts.length) continue;
    parts.push(text.slice(last));
    node.replaceWith(...parts.filter((p) => p !== ''));
  }
}
