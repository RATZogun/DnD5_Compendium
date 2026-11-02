// Retratos das espécies, sem fundo (autores no rodapé e no README): o da ficha em 512 × 512 com o busto alinhado
// embaixo e o ampliado com o corpo todo, até 1024 px no lado maior ([largura, altura] abaixo); as espécies sem
// retrato mostram o ícone.
const LARGE = {
  aarakocra: [753, 1024],
  aasimar: [872, 1024],
  bugbear: [1024, 968],
  centaur: [946, 1024],
  changeling: [427, 742],
  'chromatic-dragonborn': [832, 1024],
  'deep-gnome': [1017, 1024],
  dhampir: [773, 1024],
  duergar: [849, 1024],
  dwarf: [901, 1024],
  eladrin: [913, 1024],
  elf: [760, 1024],
  fairy: [808, 1024],
  firbolg: [954, 1024],
  'gem-dragonborn': [967, 1024],
  genasi: [566, 886],
  githyanki: [580, 867],
  githzerai: [709, 998],
  gnome: [823, 1024],
  goblin: [905, 1024],
  goliath: [942, 1024],
  'half-elf': [903, 1024],
  'half-orc': [945, 1024],
  halfling: [866, 1024],
  harengon: [742, 1024],
  hexblood: [867, 1024],
  hobgoblin: [927, 1024],
  human: [907, 1024],
  kenku: [877, 1024],
  kobold: [714, 947],
  lizardfolk: [961, 1024],
  'metallic-dragonborn': [888, 1024],
  minotaur: [822, 1024],
  orc: [1010, 1024],
  reborn: [944, 1024],
  satyr: [815, 1024],
  'sea-elf': [763, 1024],
  'shadar-kai': [390, 618],
  shifter: [846, 1024],
  tabaxi: [901, 1024],
  tiefling: [860, 1024],
  tortle: [935, 1022],
  triton: [814, 797],
  'yuan-ti': [732, 1024],
};

export const speciesArt = (slug) => (Object.hasOwn(LARGE, slug) ? `img/species/${slug}.webp` : null);

export function speciesArtLarge(slug) {
  if (!Object.hasOwn(LARGE, slug)) return null;
  const [width, height] = LARGE[slug];
  return { src: `img/species/large/${slug}.webp`, width, height };
}
