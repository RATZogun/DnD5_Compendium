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
- **Fontes**: Cinzel, Fraunces, Inter e Literata, sob a licença [SIL OFL 1.1](https://openfontlicense.org/),
  servidas pelo próprio site.

## Aviso

Projeto de fã para uso pessoal, sem afiliação com a Wizards of the Coast. Dungeons & Dragons e seus conteúdos
pertencem à Wizards of the Coast.
