// Ícones de linha de cada espécie (mesmo traço dos ícones de icons.js), no lugar da ilustração da espécie
// até ela ganhar uma arte própria.
import { icon } from './icons.js';

const DRAGON =
  '<path d="M5 2l3 4.5M19 2l-3 4.5"/><path d="M6 8c0-1.5 2.5-2.5 6-2.5s6 1 6 2.5l-1 5-5 4.5L7 13z"/><path d="M9.5 10 11 10.5M14.5 10 13 10.5M10.5 14h3"/>';

const PATHS = {
  // pena
  aarakocra:
    '<path d="M12.7 19a2 2 0 0 0 1.4-.6l6.2-6.2a6 6 0 0 0-8.5-8.5L5.6 9.9A2 2 0 0 0 5 11.3V18a1 1 0 0 0 1 1z"/><path d="M16 8 2 22M17.5 15H9"/>',
  // auréola sobre as asas
  aasimar:
    '<ellipse cx="12" cy="3.5" rx="4" ry="1.5"/><circle cx="12" cy="10" r="2.5"/><path d="M9.5 11.5C6.5 12 4 10.5 2 8c0 5 2.5 8.5 7 9M14.5 11.5c3 .5 5.5-1 7.5-3.5 0 5-2.5 8.5-7 9M12 13v8"/>',
  // cabeça peluda de orelhas redondas e presas
  bugbear:
    '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M5 13a7 7 0 0 0 14 0c0-3.5-3-6-7-6s-7 2.5-7 6z"/><path d="M9.5 12h.01M14.5 12h.01M9.5 16l1 1.5 1.5-1.5 1.5 1.5 1-1.5"/>',
  // ferradura
  centaur:
    '<path d="M7 21H5c-.6 0-1-.4-1-1C4 10.5 7.5 3 12 3s8 7.5 8 17c0 .6-.4 1-1 1h-2"/><path d="M8 21c0-6.5 1.6-12 4-12s4 5.5 4 12"/><path d="M6.5 15h.01M6.5 10.5h.01M17.5 15h.01M17.5 10.5h.01"/>',
  // rosto dividido: um lado triste, o outro sorrindo
  changeling:
    '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M8 10h.01M16 10h.01M7.5 16.5c.8-1 1.8-1.5 3-1.5M13.5 15c1.2 0 2.2-.5 3-1.5"/>',
  // cabeça de dragão soprando
  'chromatic-dragonborn': `${DRAGON}<path d="M12 19.5V22M9 19l-1.5 2.5M15 19l1.5 2.5"/>`,
  // cristais do Subterrâneo
  'deep-gnome':
    '<path d="M3 21h18"/><path d="M5.5 21 4 14l2.5-3.5L9 14l-1 7M10 21l1-13 2.5-3 2.5 3-.5 13M16.5 21l.5-5.5 2-2 1.5 2.5-1 5"/>',
  // presas e gota de sangue
  dhampir:
    '<path d="M3 7c5 3.5 13 3.5 18 0"/><path d="M7 9.3 8.5 15 10 10.2M14 10.2l1.5 4.8L17 9.3"/><path d="M12 15.5c-1 1.6-1.8 2.7-1.8 3.7a1.8 1.8 0 0 0 3.6 0c0-1-.8-2.1-1.8-3.7z"/>',
  // bigorna
  duergar:
    '<path d="M3 6h13c0 2.5 2 4 5 4v1c-3 0-5 1-6 3H9C7 14 5 12 4.5 9H3z"/><path d="M10 14v3M14 14v3M7 21l1-4h8l1 4z"/>',
  // elmo e barba trançada
  dwarf:
    '<path d="M6 10a6 6 0 0 1 12 0zM6 10 3 5.5M18 10l3-4.5M12 10v3"/><path d="M6 12c0 5 3 9 6 9s6-4 6-9M8.5 15.5c1.5-1 2.5-1 3.5 0 1-1 2-1 3.5 0M12 18v3"/>',
  // folha das estações com brilho
  eladrin:
    '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/><path d="M4 3v4M2 5h4"/>',
  // orelha pontuda
  elf: '<path d="M8 21c-1.5 0-3-1-3-3 0-2.5 2-3.5 2-7a6 6 0 0 1 8-5.6L21 2l-2.7 6.4A6 6 0 0 1 19 11c0 3.5-3 4.5-3.5 7a3 3 0 0 1-3 3z"/><path d="M10 12a2.5 2.5 0 0 1 4-2M11 16.5c1 0 2-.6 2-1.5"/>',
  // asas de fada
  fairy:
    '<path d="M12 8v13"/><circle cx="12" cy="5.5" r="2"/><path d="M12 10C9 5 3 4 3 8c0 3 4 4.5 9 4M12 10c3-5 9-6 9-2 0 3-4 4.5-9 4M12 13c-3 0-6 2-5.5 4.5S11 18 12 15M12 13c3 0 6 2 5.5 4.5S13 18 12 15"/>',
  // árvore
  firbolg:
    '<path d="M12 22v-8M9 22h6"/><path d="M12 14c-4.5 0-8-2-8-5.5a4 4 0 0 1 3-3.9A5 5 0 0 1 12 2a5 5 0 0 1 5 2.6 4 4 0 0 1 3 3.9C20 12 16.5 14 12 14z"/><path d="M12 14l-3-3M12 12l2.5-2.5"/>',
  // gema lapidada
  'gem-dragonborn': '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21 8 9l2-6M12 21l4-12-2-6"/>',
  // orbe com o redemoinho dos elementos
  genasi:
    '<circle cx="12" cy="12" r="9"/><path d="M12 7c-2.5 0-4.5 1.8-4.5 4.5S9.5 16 12 16s3.5-1.6 3.5-3.5S14 9.5 12.5 9.5 10 10.5 10 12s1 2 2 2"/>',
  // espada de prata
  githyanki: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2"/>',
  // lótus da meditação
  githzerai:
    '<path d="M12 20c-2-2-3-4.5-3-7.5S10.5 7 12 5c1.5 2 3 4.5 3 7.5S14 18 12 20z"/><path d="M12 20c-4 0-7.5-2.5-8.5-7 2.5 0 4.5.7 5.8 2M12 20c4 0 7.5-2.5 8.5-7-2.5 0-4.5.7-5.8 2M5 21h14"/>',
  // engrenagem de inventor
  gnome:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>',
  // cabeça de orelhas longas
  goblin:
    '<path d="M7 9 2 6l2 6h3M17 9l5-3-2 6h-3"/><path d="M7 9c0-2.5 2.2-4 5-4s5 1.5 5 4v4c0 3.5-2.2 6-5 6s-5-2.5-5-6z"/><path d="M10 11h.01M14 11h.01M10.5 15.5h3"/>',
  // montanha
  goliath: '<path d="m8 3 4 8 5-5 5 15H2z"/><path d="m6 11 2 2 2-2M14.5 11l2.5-2.5 2 2"/>',
  // meio-elfo: rosto com uma orelha redonda e a outra pontuda
  'half-elf':
    '<circle cx="12" cy="12" r="6"/><path d="M12 6v12"/><path d="M6 10.3a1.8 1.8 0 0 0 0 3.4M18 10l4-4.5-1.3 7L18 14"/>',
  // pés de pequenino
  halfling:
    '<path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0z"/><path d="M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0z"/><path d="M16 17h4M4 13h4"/>',
  // meio-orc: rosto com uma presa de um lado
  'half-orc': '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M9 10h.01M15 10h.01M8 15.5h8M14 15.5l1.2-4.5 1.2 4.5"/>',
  // cabeça de lebre
  harengon:
    '<path d="M9 9C7.5 6 7 3.5 8 2.5c1.5-1 3 2 3.5 5.5M15 9c1.5-3 2-5.5 1-6.5-1.5-1-3 2-3.5 5.5"/><circle cx="12" cy="14" r="6"/><path d="M10 13h.01M14 13h.01M11 16.5l1 .8 1-.8"/>',
  // chapéu de bruxa
  hexblood:
    '<path d="M2 19c3 1.5 7 2 10 2s7-.5 10-2c-2-1-5-1.5-7-1.5"/><path d="M8 17.5 11 6l-3-3c3 0 6 1.5 7 4l1 10.5"/><path d="M8 17.5c2.5.7 5.5.7 8 0"/>',
  // estandarte de guerra
  hobgoblin: '<path d="M5 22V2"/><path d="M5 3h13l-3 4.5 3 4.5H5"/><path d="M9.5 6l1.5 1.5L9.5 9"/>',
  // pessoa
  human: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/>',
  // cabeça de corvo
  kenku: '<path d="M4 9a6 6 0 0 1 10-3.5L21 9l-6.5 2A6 6 0 0 1 8 20H4z"/><path d="M9 8.5h.01M14.5 11 13 13"/>',
  // picareta de minerador
  kobold: '<path d="M14.5 9.5 4 20"/><path d="M5 6c4.5-3.5 10.5-4 15-3 1 4.5.5 10.5-3 15"/><path d="M10 7l7 7"/>',
  // olho de réptil
  lizardfolk:
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><path d="M12 7.5c-1 1.5-1.5 3-1.5 4.5s.5 3 1.5 4.5c1-1.5 1.5-3 1.5-4.5S13 9 12 7.5z"/>',
  // cabeça de dragão com brilho metálico
  'metallic-dragonborn': `${DRAGON}<path d="M21 15v4M19 17h4M4 17v3M2.5 18.5h3"/>`,
  // cabeça de touro com argola
  minotaur:
    '<path d="M7 8C4 8 2 6 2 3c1.5 2 3 2 5.5 2M17 8c3 0 5-2 5-5-1.5 2-3 2-5.5 2"/><path d="M7 7c0 0 1-2 5-2s5 2 5 2l-1 7c0 4-2 6-4 6s-4-2-4-6z"/><path d="M10 10h.01M14 10h.01"/><circle cx="12" cy="18" r="2"/>',
  // mandíbula com presas
  orc: '<path d="M5 9a7 7 0 0 1 14 0v4a7 7 0 0 1-14 0z"/><path d="M9 10h.01M15 10h.01M8 16c2.5 1.3 5.5 1.3 8 0M9 16.4l-.5-3.4M15 16.4l.5-3.4"/>',
  // crânio costurado
  reborn:
    '<path d="M8 21v-3a7 7 0 1 1 8 0v3z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/><path d="M10 21v-2M14 21v-2M12 3v3M11 4h2"/>',
  // flauta de pã
  satyr: '<path d="M3 5h18l-2 4H5z"/><path d="M5 9v10M8.5 9v8M12 9v6M15.5 9v4.5M19 9v3"/>',
  // ondas do mar
  'sea-elf':
    '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  // lua crescente
  'shadar-kai': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/><path d="M17 4h.01M20 7h.01"/>',
  // marcas de garras
  shifter: '<path d="M6 3c1 6-1 12-3 17M11.5 3c1 6 0 12-2 18M17 3c1.5 6 1 12-1 17M21 6c.5 4 0 8-1.5 11"/>',
  // cabeça de gato
  tabaxi:
    '<path d="M12 5c1.7 0 3.3.5 4.5 1.3L19 3l1 6c.7 1.2 1 2.6 1 4 0 4.5-4 8-9 8s-9-3.5-9-8c0-1.4.3-2.8 1-4l1-6 2.5 3.3C8.7 5.5 10.3 5 12 5z"/><path d="M9 12h.01M15 12h.01M11 15.5l1 .8 1-.8M3 15l4-.5M21 15l-4-.5"/>',
  // cabeça de chifres recurvados
  tiefling:
    '<circle cx="12" cy="15" r="6"/><path d="M8 10.5C5 9 4 6 5 2.5c1 2.5 2.5 3.5 4.5 4.5M16 10.5c3-1.5 4-4.5 3-8-1 2.5-2.5 3.5-4.5 4.5"/><path d="M9.5 14.5 11 15M14.5 14.5 13 15M10 18c1.3.7 2.7.7 4 0"/>',
  // casco de tartaruga
  tortle:
    '<path d="M3 15a9 8 0 0 1 18 0z"/><path d="M8 15l1.5-4.5h5L16 15M9.5 10.5 8 7.5M14.5 10.5 16 7.5M12 7v3.5"/><path d="M5 15v3M19 15v3M21 13.5h1.5"/>',
  // tridente
  triton: '<path d="M12 22V5M5 3v4a7 7 0 0 0 14 0V3M12 2l-1.5 3h3z"/><path d="M5 3 3.5 5M19 3l1.5 2M10 18h4"/>',
  // serpente
  'yuan-ti':
    '<path d="M16 3h2.5a2.5 2.5 0 0 1 0 5H8a3.5 3.5 0 0 0 0 7h8a3.5 3.5 0 0 1 0 7H5"/><path d="M5 22l-2 1M5 22l-2-1.5"/><path d="M17.5 5.5h.01"/>',
};

const line = (paths, size) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const speciesIcon = (slug, size = 24) => (PATHS[slug] ? line(PATHS[slug], size) : icon.people(size));
export const SPECIES_ICON_SLUGS = Object.keys(PATHS);
