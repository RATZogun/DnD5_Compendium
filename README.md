# DnD5 Compendium

Compêndio pessoal de D&D 5e com magias, classes e espécies em português e inglês, inspirado no extinto
**dnd5spells.rpgist.net**. É um site estático, sem backend nem etapa de build, que roda direto no navegador.

Acesse em **[ratzogun.github.io/DnD5_Compendium](https://ratzogun.github.io/DnD5_Compendium/)**.

## Funcionalidades

- **Magias** (`#/magias`): 484 magias com filtros, ordenação, paginação e página própria para cada magia.
- **Classes** (`#/classes`): 13 classes completas, com tabela de progressão e todas as características, e 108
  subclasses, cada uma com página própria.
- **Espécies** (`#/especies`): 44 espécies com traços, sub-espécies e magias inatas.
- **Gerar Pergaminho** (`#/pergaminho`): sorteia uma magia de acordo com os filtros.
- Interface em português e inglês, modo claro e escuro.

Todo o conteúdo cita o livro e a página de origem.

## Rodar localmente

Os módulos ES precisam de um servidor HTTP (abrir o `index.html` direto do disco não funciona):

```bash
python3 -m http.server 8765
```

Depois acesse http://localhost:8765.

## Desenvolvimento

```bash
npm install
```

- `npm run lint`: ESLint.
- `npm run format:check`: Prettier.
- `npm run format:check:json`: confere se todos os JSON (inclusive os de `data/`) estão formatados.
- Um hook de `pre-commit` (Husky + lint-staged) formata e corrige os arquivos alterados antes de cada commit.
- O GitHub Actions roda as mesmas checagens em cada push e pull request para a `main`.

## Estrutura

- `index.html`, `css/`: página e estilos.
- `js/app.js`: ponto de entrada e rotas por hash (funcionam no GitHub Pages sem configuração).
- `js/i18n.js`: textos da interface nos dois idiomas.
- `js/data.js`: carregamento dos dados e regras (conjuradores, nível máximo de magia).
- `js/components/`: esqueleto das páginas de leitura, filtros laterais de magia, ficha de magia, busca global e
  paginação.
- `js/views/`: uma view por página.
- `data/rules.pt.json` e `data/rules.en.json`: magias e resumo de classes e espécies, um arquivo por idioma.
- `data/classes/` e `data/species/`: detalhes completos de cada classe e espécie, carregados sob demanda.

## Créditos

- **Tradução**: textos em português da [Biblioteca Élfica](https://bibliotecaelfica.org/).
- **Inspiração**: o extinto [dnd5spells.rpgist.net](https://web.archive.org/web/2022/https://dnd5spells.rpgist.net/).
- **Ícones de classe**: [Jime Mosqueda](https://dribbble.com/jimemosqueda), designer gráfico e ilustrador
  (DND Icons Set), vetorizados a partir das artes originais.
- **Ícones das escolas de magia**: do [game-icons.net](https://game-icons.net/), sob a licença
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), recoloridos para o site:
  - Abjuração: _Magic shield_, por Lorc
  - Adivinhação: _Crystal ball_, por Lorc
  - Conjuração: _Magic portal_, por Lorc
  - Encantamento: _Psychic waves_, por Lorc
  - Evocação: _Fireball_, por Lorc
  - Ilusão: _Magick trick_, por Delapouite
  - Necromancia: _Raise zombie_, por Skoll
  - Transmutação: _Frog prince_, por Delapouite
- **Ícones das espécies**: também do [game-icons.net](https://game-icons.net/), sob a licença
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), recoloridos para o site:

  | Espécie               | Ícone                   | Autor       |
  | --------------------- | ----------------------- | ----------- |
  | Aarakocra             | _Eagle head_            | Delapouite  |
  | Aasimar               | _Angel wings_           | Lorc        |
  | Anão                  | _Dwarf face_            | Delapouite  |
  | Bugurso               | _Bear face_             | Sparker     |
  | Centauro              | _Centaur_               | Delapouite  |
  | Dampir                | _Fangs circle_          | Lorc        |
  | Draconato Cromático   | _Spiked dragon head_    | Delapouite  |
  | Draconato Gema        | _Dragon orb_            | Delapouite  |
  | Draconato Metálico    | _Dragon shield_         | Delapouite  |
  | Duergar               | _Dwarf helmet_          | Kier Heyl   |
  | Duplicante            | _Duality mask_          | Lorc        |
  | Eladrin               | _Leaf swirl_            | Lorc        |
  | Elfo                  | _Elf ear_               | Delapouite  |
  | Elfo Marinho          | _Mermaid_               | Delapouite  |
  | Fada                  | _Fairy_                 | Delapouite  |
  | Firbolg               | _Tree face_             | Cathelineau |
  | Genasi                | _Triple yin_            | Lorc        |
  | Githyanki             | _Alien skull_           | Lorc        |
  | Githzerai             | _Meditation_            | Lorc        |
  | Gnomo                 | _Bad gnome_             | Cathelineau |
  | Gnomo das Profundezas | _Crystal bars_          | Lorc        |
  | Goblin                | _Goblin head_           | Delapouite  |
  | Golias                | _Giant_                 | Delapouite  |
  | Halfling              | _Hobbit door_           | Delapouite  |
  | Hobgoblin             | _Samurai helmet_        | Delapouite  |
  | Humano                | _Meeple_                | Delapouite  |
  | Kenku                 | _Kenku head_            | Delapouite  |
  | Kobold                | _Gecko_                 | Lorc        |
  | Laparlonj             | _Rabbit head_           | Delapouite  |
  | Meio-elfo             | _Woman elf face_        | Delapouite  |
  | Meio-orc              | _Boar tusks_            | Lorc        |
  | Minotauro             | _Minotaur_              | Lorc        |
  | Morfo                 | _Werewolf_              | Lorc        |
  | Orc                   | _Orc head_              | Delapouite  |
  | Renascido             | _Frankenstein creature_ | Lorc        |
  | Reptante              | _Lizardman_             | Lorc        |
  | Sangue de Bruxa       | _Witch face_            | Cathelineau |
  | Shadar-kai            | _Two shadows_           | Lorc        |
  | Sátiro                | _Pan flute_             | Delapouite  |
  | Tabaxi                | _Cat_                   | Lorc        |
  | Tiefling              | _Devil mask_            | Delapouite  |
  | Tortuga               | _Turtle_                | Lorc        |
  | Tritão                | _Trident_               | Lorc        |
  | Yuan-ti               | _Snake_                 | Lorc        |

- **Resumo de regras**: conteúdo do [dnd5e-quickref](https://github.com/crobi/dnd5e-quickref), criado por Robert Autenrieth
  ([crobi](https://github.com/crobi), versão em inglês), traduzido para o português e adaptado por
  [diogoan](https://github.com/diogoan/dnd5e-quickref), com adições de [crdornelles](https://github.com/crdornelles);
  os dois projetos estão sob a licença [MIT](https://opensource.org/license/mit). As seções que só existem na versão
  em português (habilidades, jogadas e outros efeitos do ambiente) foram vertidas para o inglês neste projeto.

  > Copyright (c) 2016 Robert Autenrieth
  >
  > Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
  > documentation files (the "Software"), to deal in the Software without restriction, including without limitation
  > the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
  > permit persons to whom the Software is furnished to do so, subject to the following conditions:
  >
  > The above copyright notice and this permission notice shall be included in all copies or substantial portions of
  > the Software.
  >
  > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
  > THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  > AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
  > TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  > SOFTWARE.

- **Ícones do resumo de regras**: os mesmos do dnd5e-quickref, do [game-icons.net](https://game-icons.net/), sob a
  licença [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), recoloridos para o site (o de rastejar é o
  desenho próprio do dnd5e-quickref, vetorizado):
  - Lorc: _Aerial signal_, _At sea_, _Aura_, _Bleeding eye_, _Broken shield_, _Charm_, _Coma_, _Cracked shield_, _Crags_, _Crossed swords_, _Deathcab_, _Drowning_, _Duality_, _Embrassed energy_, _Eye shield_, _Fruiting_, _Grab_, _Hand_, _High five_, _Hood_, _Imprisoned_, _Internal injury_, _Journey_, _Juggler_, _Lightning tear_, _Magic swirl_, _Magnifying glass_, _Manacles_, _Master of arms_, _Ninja mask_, _One eyed_, _Paw_, _Run_, _Semi closed eye_, _Sharp smile_, _Shield reflect_, _Smitten_, _Snatch_, _Sprint_, _Star pupil_, _Stopwatch_, _Strong_, _Sword tie_, _Telepathy_, _Uncertainty_, _Vile fluid_, _Wingfoot_, _Worried eyes_
  - Delapouite: _Achilles heel_, _Arrest_, _Book pile_, _Church_, _Discobolus_, _Elf ear_, _Gargoyle_, _Idea_, _Invisible_, _Robber_, _Sherlock holmes_, _Smart_, _Stairs goal_, _Stone pile_, _Sword brandish_, _Weight lifting up_, _Wisdom_
  - Sbed: _Falling_, _Health normal_, _Medical pack_, _Shield_
  - DarkZaitzev: _Acrobatic_
  - Willdabeast: _Round shield_

- **Fontes**: Cinzel, Fraunces, Inter e Literata, sob a licença [SIL OFL 1.1](https://openfontlicense.org/),
  servidas pelo próprio site
  (licença e avisos de copyright em [fonts/OFL.txt](fonts/OFL.txt)).

## Aviso

Projeto de fã para uso pessoal, sem afiliação com a Wizards of the Coast. Dungeons & Dragons e seus conteúdos
pertencem à Wizards of the Coast.
