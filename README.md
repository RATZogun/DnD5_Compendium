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
- **Regras** (`#/regras`): Resumo de Regras (ações, condições, testes, cobertura, visão e luz, com ícones e a
  página do livro) e Opções e Recursos (151 invocações, manobras, infusões, disciplinas e outras opções de
  classe). Os termos de regra citados nas magias, classes e espécies levam ao resumo e mostram a ficha ao passar o
  mouse.
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
- `data/quickref.json`: resumo de regras nos dois idiomas, com os ícones.
- `data/options.json`: opções e recursos de classe.
- `fonts/`: fontes servidas pelo próprio site e a licença delas.
- `img/species/`: retratos das espécies (WebP, fundo transparente): o da ficha em 512 × 512 e, em `large/`, o
  ampliado com o corpo todo, até 1024 px no lado maior.

## Créditos

- **Textos**: tradução da [Biblioteca Élfica](https://bibliotecaelfica.org/). Inspirado no extinto
  [dnd5spells.rpgist.net](https://web.archive.org/web/2022/https://dnd5spells.rpgist.net/).
- **Ícones de classe**: [Jime Mosqueda](https://dribbble.com/jimemosqueda) (DND Icons Set), vetorizados.
- **Ícones de escolas, espécies e do resumo de regras**: [game-icons.net](https://game-icons.net/), por Lorc,
  Delapouite, Skoll, Cathelineau, Kier Heyl, Sparker, Sbed, DarkZaitzev e Willdabeast, sob a licença
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), recoloridos (o nome de cada ícone está em
  `js/schoolIcons.js`, `js/speciesIcons.js` e `data/quickref.json`). O ícone de rastejar é do dnd5e-quickref.
- **Retratos das espécies**: [HIIDRA Studios](https://www.patreon.com/morvoldpress) (Morvold Press),
  [wangdaye](https://wangdaye.artstation.com/) (Centauro e Minotauro), [yanavaseva](https://yanavaseva.tumblr.com/)
  (Shadar-kai), [avocadraw9](https://avocadraw9.artstation.com/) (Eladrin), [ryuutsu](https://ryuutsu.artstation.com/)
  (Elfo Marinho), [Deoxy Diamond](https://deoxy_diamond.artstation.com/) (Fada), [alew](https://www.artstation.com/alew)
  (Githyanki) e [boissb](https://www.artstation.com/boissb) (Tritão), com fundo removido e tamanho padronizado. Autor
  não identificado: Draconato Gema, Duplicante, Firbolg, Genasi, Githzerai, Kobold, Laparlonj e Tortle.
- **Resumo de regras**: [dnd5e-quickref](https://github.com/crobi/dnd5e-quickref), de Robert Autenrieth (crobi),
  traduzido por [diogoan](https://github.com/diogoan/dnd5e-quickref) com adições de crdornelles, sob a licença MIT;
  as seções que só existiam em português foram vertidas para o inglês aqui.
- **Fontes**: Cinzel, Fraunces, Inter e Literata, servidas pelo próprio site, sob a licença
  [SIL OFL 1.1](fonts/OFL.txt).

<details>
<summary>Aviso de licença MIT do dnd5e-quickref</summary>

```text
Copyright (c) 2016 Robert Autenrieth

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

</details>

## Aviso

Projeto de fã para uso pessoal, sem afiliação com a Wizards of the Coast. Dungeons & Dragons e seus conteúdos
pertencem à Wizards of the Coast.
