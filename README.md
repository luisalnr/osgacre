# Orçamento Sensível ao Gênero — Acre

Site institucional e painel de acompanhamento do Orçamento Sensível ao Gênero (OSG)
do Estado do Acre, instituído pela **Lei nº 4.168, de 6 de setembro de 2023**.

Terceiro dos orçamentos temáticos do estado, ao lado de
[ocadac.vercel.app](https://ocadac.vercel.app/) (Criança e Adolescente) e
[orclima.vercel.app](https://orclima.vercel.app/) (Climático).

Next.js 16 · React 19 · Tailwind 4 · Recharts · Drizzle + Neon Postgres · deploy no Vercel.

---

## Como os dados funcionam

**A verdade dos dados mora no Neon**, não no repositório.

- `public/data/seed-osg.json`, `seed-qdd.json` e `seed-leis.json` são a **carga inicial**,
  geradas a partir das planilhas de `_fontes/`. Elas também servem de reserva: sem `DATABASE_URL`
  configurada, o site sobe mostrando essa carga em vez de quebrar.
- A atualização de produção acontece pela aba **/admin → Importação**: a planilha é lida
  no navegador, conferida na prévia e gravada no Neon. Não se atualiza dado commitando
  xlsx novo.

### Duas fontes de registro

O OSG mudou de origem no meio do caminho, e as duas convivem:

| Exercício | Fonte | Parser |
|---|---|---|
| 2024, 2025 | `OSG TOTAL.xlsx`, aba `Tabela_OSG` — planilha montada à mão pelo COSG | `parser-osg.ts` |
| 2026 em diante | `OSG_SistemaOrcamentosTematicos.xlsx`, aba `Resultados` — relatório do **Sistema de Orçamentos Temáticos** | `parser-orcamentos-tematicos.ts` |

São dois arquivos separados de propósito: os layouts não se parecem e cada um tem as
suas exceções. O que os dois compartilham — ler célula, casar coluna por sinônimo,
achar cabeçalho — está em `parser-comum.ts`, para que não divirjam em silêncio.

Os dois gravam na mesma tabela `osg_registros`, com os mesmos slugs de eixo e os mesmos
códigos de órgão e unidade. É isso que torna os exercícios comparáveis. Os ids não
colidem: o parser novo os prefixa com `ot`.

### Granularidade

Uma linha da planilha é uma **entrega apropriada**. Uma **dotação**
(exercício + órgão + unidade + projeto/atividade) reúne várias entregas — o painel agrupa
por dotação e abre para mostrar as entregas.

**O valor muda de nível entre as duas fontes.** A Tabela OSG traz o valor já discriminado
por entrega. O relatório novo informa o planejado na **dotação**, uma vez só, na primeira
linha do grupo; apenas as dotações de categoria 2 discriminam por entrega, na coluna
`Planejado da Entrega`. Nas demais, o valor de cada entrega é rateio — a divisão do valor
da dotação pelo número de entregas, com o resto dos centavos na primeira, de modo que a
soma devolva o valor da dotação **ao centavo**. São 6 dotações de 121 em 2026.

`planejado_dotacao` guarda o valor informado pela fonte e serve de conferência; quem soma
continua somando `aprop_osg`, porque é ele que encolhe junto quando um filtro seleciona
parte das entregas. O campo `planejado_entrega` nulo é o que marca um valor como rateio, e
o painel e o XLSX dizem isso na tela em vez de apresentar a divisão como número apurado.

### Ponderador e categoria

O relatório novo traz o `Ponderador` numa coluna própria: 1 na categoria 1, 0,5 na
categoria 3, **vazio** na categoria 2 — onde não há fator, porque ali o próprio órgão
discrimina quanto da dotação foi apropriado.

**O `Planejado ponderado` já chega ponderado.** Conferido contra o QDD 2026:
`planejado ÷ dotação inicial` dá exatamente 0,500 nas 53 dotações da categoria 3 e 1,000
nas 14 da categoria 1 que não são emenda parlamentar. Aplicar o ponderador de novo na
importação reduziria o exercício à metade.

O ponderador é gravado como a fonte o informa e conferido contra `ponderadorDe(categoria)`
(`referencias.ts`), que é também o recuo para 2024/2025 — cuja planilha não tinha a coluna.
Divergência entre os dois vira aviso na importação, em vez de uma escolha silenciosa.

### Emendas parlamentares

Emenda entra na LOA com **dotação inicial zerada por construção** — só recebe valor depois
da alocação dos planos de trabalho dos parlamentares, e isso aparece na dotação atualizada.
O Sistema de Orçamentos Temáticos calcula o planejado sobre a inicial, então **reporta zero
para todas elas**.

A importação recupera o valor: quando `ehEmendaParlamentar` (`agregacoes.ts`) reconhece a
dotação **e** o relatório trouxe zero **e** o QDD tem dotação atualizada positiva, o
planejado passa a ser `ponderador × dotação atualizada`. É o mesmo tratamento que 2024 e
2025 já davam — lá o COSG preenchia o valor à mão, e `baseDotacao` já usa a atualizada como
denominador quando a dotação é emenda. Em 2026 são **16 emendas, somando R$ 1.112.400,00**
(outras duas seguem zeradas porque a atualizada delas ainda é zero).

Só onde o relatório reporta zero. Se o COSG apurou um valor para a emenda, esse valor vence
— e uma divergência entre ele e a dotação atualizada vira aviso, para o Comitê ver em vez
de o código escolher.

A coluna **`planejado_origem`** marca a diferença: `relatorio` (o normal) ou
`dotacao-atualizada`. Sem ela um valor calculado na importação ficaria indistinguível de um
valor apurado pelo Comitê. Ela aparece na linha expandida da tabela e numa coluna do XLSX.

> **O QDD é um retrato móvel.** Ele muda ao longo do exercício, e as emendas recebem valor
> progressivamente. Como a derivação é gravada na importação, **reimporte o relatório
> sempre que atualizar o QDD** — a prévia mostra quantas emendas receberam valor e quanto
> somam, que é como se confere isso sem abrir o banco.

**Nem toda dotação zerada é emenda.** A 719/637 ação 13460000 (FUNDESEG) tem inicial zero
porque sua única fonte é a 27130700 — transferência fundo a fundo do FSP, superávit. A
dotação inicial dela é essa mesmo, e ela fica zerada de propósito; `ehEmendaParlamentar`
corretamente não a alcança. A importação avisa separadamente sobre dotações zeradas que não
são emenda, que são exatamente as que merecem conferência.

### Exercícios em apuração

`EXERCICIOS_EM_APURACAO` em `referencias.ts` lista os exercícios cuja execução ainda não
foi encerrada. Hoje: `[2026]`.

Nesses exercícios o liquidado **é gravado no banco mas não é exibido** — nem nos KPIs, nem
nos gráficos, nem na tabela, nem no XLSX, nem no PDF. O planejado vem da lei orçamentária e
está fechado; o liquidado é um acumulado parcial do ano em curso. Exibir os dois lado a
lado faria o exercício corrente parecer pior do que vai terminar.

A supressão é decidida em `calcularTotais` e `somarPor` (`agregacoes.ts`), que devolvem
`liq: null`, e não em cada componente — é o que impede o painel, a planilha e o PDF de
discordarem entre si. Num recorte que mistura exercícios abertos e fechados o liquidado
**continua aparecendo**: a regra é "todos em apuração", não "algum". No gráfico de evolução
cada ano responde por si, então 2026 entra com planejado e sem liquidado.

Encerrado o exercício, apaga-se o ano da lista. É uma constante explícita, e não uma
dedução a partir do ano corrente: quem declara um exercício encerrado é o COSG, e um painel
publicado que muda sozinho na virada do ano muda sem ninguém ter decidido.

### O QDD é a fonte do tamanho da dotação

`Valor de Apropriação OSG` e `Valor Liquidado e Apropriado OSG` são valores reais por
entrega — são os dois únicos que o painel exibe como coluna.

O tamanho da dotação (para calcular quanto dela foi apropriado ao OSG) **vem do QDD**, não
da planilha do OSG. Duas razões:

1. As colunas de projeto da planilha chegam rateadas por linha, mas de forma
   **inconsistente**: em parte das dotações o valor vem repetido em cada linha em vez de
   dividido, e somar dá o dobro. Elas continuam gravadas (`orc_aprovado_projeto`,
   `orc_final_projeto`, `liq_projeto_total`) só como reserva, para o site funcionar antes
   de o QDD ser importado.
2. A dotação inicial não conta a história toda. Remanejamentos durante o exercício e
   emendas parlamentares — que entram na LOA zeradas — só aparecem na coluna
   `Ini+Sup+Cor-Red (B)` do QDD. Ter os dois valores é o que permite dizer *por que* uma
   dotação não comporta o planejado.

**A regra do denominador** (`baseDotacao`, em `src/lib/agregacoes.ts`): a base é a
**dotação inicial da LOA**. A apropriação do OSG é um número de planejamento, feito sobre a
lei orçamentária — trocar o denominador por causa de uma suplementação posterior mudaria o
significado do percentual sem o leitor perceber. É a inicial, também, que faz a metodologia
fechar: categoria 1 dá 100% e categoria 3 dá 50%.

Esse fechamento é **exato em 2026**, onde o planejado é calculado pelo próprio sistema como
`ponderador × dotação inicial` (30 de 30 na categoria 1 e 53 de 53 na categoria 3). Em 2024 e
2025 o valor é apurado à mão pelo COSG e a razão apenas tende a esses números: seis dotações
foram apropriadas por outro critério, e `conferir-base.ts` as lista nominalmente.

A exceção são as **emendas parlamentares**, identificadas por "emenda" na aplicação
programada ou pelo projeto/atividade começando em `8028`. Elas entram na LOA com dotação
inicial zerada por construção e só recebem valor depois da alocação dos planos de trabalho;
sem a atualizada não existe denominador. São 44 dotações nos três exercícios: 9 em 2024,
17 em 2025 e 18 em 2026.

Quando o planejado passa da dotação inicial, **a base não muda**: o percentual dá lugar a
uma anotação, porque o cálculo sobre a inicial produziria coisas como 8.208% ou 27.375.190%
(dotação inicial de R$ 1,00). São dois estados:

- **suplementada** (12 dotações: 1 em 2024, 4 em 2025, 7 em 2026) — o planejado cabe na
  dotação atualizada, ou seja, a dotação foi reforçada durante o exercício. Ex.: FAPAC
  2025/12190000, R$ 233.007,00 iniciais → R$ 8.971.302,24 atualizados. É rotina
  orçamentária, e não vira aviso na importação.
- **a conferir** (4 dotações) — nem a atualizada cobre o planejado. São erros de registro na
  planilha de origem, listados nas checagens da importação: SESACRE 2024/11900000,
  PCAC 2025/11080000 e a IAPEN 21870000, que aparece em 2025 e se repete em 2026.

A anotação aparece no detalhe da linha e na coluna `Anotação` da exportação XLSX.

### Órgão e unidade orçamentária

A Tabela OSG traz órgão e unidade fundidos numa string preenchida à mão
(`721/302 - FUNDHACRE`, `754 - SEOP`), e o que ela chama de órgão é, em parte das linhas,
o **executor** da entrega — não a unidade onde a dotação está. Na importação, `resolverUnidade`
(`src/lib/resolver-unidade.ts`) resolve os dois contra o QDD, que é a fonte canônica, e o
registro é gravado com código e nome de cada um. `721/302 - FUNDHACRE` vira órgão
`721 SECRETARIA DE ESTADO DE SAÚDE - SESACRE` e unidade
`302 FUNDAÇÃO HOSPITAL ESTADUAL DO ACRE- FUNDHACRE`.

Não existe regra simples, e três atalhos plausíveis são falsos:

- **"sem barra quer dizer unidade 001"** — das 153 linhas sem barra, 26 pertencem a outra
  unidade. As 12 da SESACRE estão todas no `721/607 FUNDO ESTADUAL DE SAÚDE`, e 7 da SEASDH,
  no `760/608 FEAS`.
- **"o código depois da barra é a unidade"** — `719/219` para o IAPEN não existe em nenhum
  exercício; no QDD ele é `719/209`.
- **"o órgão da planilha é o órgão da dotação"** — em 2024, 13 linhas de PMAC, CBMAC e PCAC
  têm projetos que no QDD só existem na SEJUSP, com a dotação no `719/637 FUNDESEG`.

Quem resolve quase tudo é o projeto/atividade: 149 das 185 linhas casam numa unidade só. As
outras estão em `EXCECOES_UNIDADE`, cada uma decidida somando o grupo do projeto e comparando
com o QDD — `Orçamento Aprovado` bate com a dotação inicial e `Orçamento Final` com a
atualizada, dois sinais que concordam. O que não fechar vira erro na importação, com os
candidatos, em vez de entrar em silêncio.

Os nomes vêm do QDD, que os grava quebrados na largura da coluna do relatório
(`MEIO AMBIEN TE`, `PENITEN- CIÁRIA`). `limparNome` (`src/lib/orgaos.ts`) junta o que é
seguro juntar e deixa em paz `ACRE- FUNDHACRE`, onde o hífen separa a sigla.

A junção com o QDD é por `(exercício, órgão, unidade, projeto/atividade)`, com recuo para
`(exercício, órgão, projeto/atividade)` e depois `(exercício, projeto/atividade)`.

### Conferência

Os totais batem com os relatórios publicados:

| Exercício | Entregas | Dotações | Planejado | Liquidado | Execução |
|---|---|---|---|---|---|
| 2024 | 82 | 62 | R$ 171.143.631,23 | R$ 114.622.947,14 | 67,0% |
| 2025 | 103 | 89 | R$ 220.468.189,96 | R$ 140.031.314,55 | 63,5% |
| 2026 | 169 | 121 | R$ 262.607.886,87 | *em apuração* | *em apuração* |

Por categoria em 2026: R$ 39.498.032,84 (cat. 1), R$ 88.318.450,56 (cat. 2) e
R$ 134.791.403,47 (cat. 3). A categoria 1 inclui R$ 1.112.400,00 de emendas parlamentares
recuperados da dotação atualizada — ver *Emendas parlamentares*, acima. As 121 dotações casam com o QDD 2026 pelo par
órgão/unidade e projeto — 121 de 121.

**Dois centavos de cuidado.** O relatório de 2026 traz dois valores com fração de centavo
(R$ 1.684.233,805 e R$ 3.474.893,875) e a coluna do banco tem duas casas. Arredondar a
metade para cima somaria R$ 261.495.486,88, um centavo acima da soma exata. Por isso
`centavos()` em `parser-comum.ts` arredonda **a metade para o par**, que não enviesa numa
direção — as duas frações caem para lados diferentes e o total se preserva.

### O que a importação de 2026 avisa

Quatro avisos aparecem na prévia do `/admin` e não são erro de leitura — são fatos do dado
que valem conferência com o COSG:

- **16 emendas parlamentares com o planejado recuperado do QDD**, somando R$ 1.112.400,00,
  e **2 que continuam zeradas** porque a dotação atualizada delas também está em zero. Ver
  *Emendas parlamentares*, acima.
- **1 dotação zerada que não é emenda**: a 719/637 ação 13460000, financiada só por
  superávit. Fica zerada de propósito — a dotação inicial dela é zero mesmo.
- **Dotações em que o liquidado supera o planejado.** É o efeito de medir o planejado sobre
  a LOA e o liquidado sobre a execução corrente, que já incorpora suplementações. É também
  o argumento técnico para não exibir a execução do exercício antes de ele fechar.
- **2 linhas com `Planejado da Entrega` fora da categoria 2** (linhas 78 e 159). Nelas o
  valor não vem ponderado e discorda do planejado da dotação, então é ignorado — o valor da
  entrega sai do rateio. É por isso que o gatilho do rateio é a **categoria**, e nunca a
  presença da coluna.
- **2 valores com fração de centavo**, descritos acima.

---

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local     # preencha as variáveis do Neon
npm run dev                          # http://localhost:3000
```

Sem `DATABASE_URL` o site funciona em modo leitura, servido pelos JSON de
`public/data/`. Para ligar o banco:

```bash
npm run db:push          # cria as tabelas no Neon
npm run data:build       # regenera os JSON a partir de _fontes/ (opcional)
npm run db:seed          # carga inicial — DESTRUTIVO, apaga e regrava tudo
npm run db:seed-admin    # cria o usuário do /admin com ADMIN_EMAIL/ADMIN_PASSWORD
```

**Entrar no `/admin` sem banco.** O usuário do `/admin` mora na tabela `osg_usuarios`, então sem
Neon não há conta para logar. Para esse caso existe um login local: gere o hash com
`npx tsx scripts/hash-senha.ts "sua senha"` e preencha `ADMIN_LOCAL_EMAIL` e
`ADMIN_LOCAL_SENHA_HASH` no `.env.local` — a senha em texto nunca vai para o arquivo. Ele pede
e-mail e senha como o login de verdade, usa o mesmo scrypt e a mesma sessão assinada, e só
funciona com `NODE_ENV != production` **e** sem `DATABASE_URL`: havendo banco, a conta volta a
ser a de `osg_usuarios` e as variáveis locais ficam inalcançáveis. Em produção quem cria a conta
é sempre o `db:seed-admin`. Há ainda o `ADMIN_DEV_BYPASS=1`, que abre a área restrita sem senha
alguma; prefira o login local, que ao menos autentica. Em qualquer dos dois a **importação
continua falhando** sem `DATABASE_URL` — o que se libera é a interface, não o banco.

`npm run data:build` imprime os totais por exercício, categoria e eixo — use a saída para
conferir contra a tabela acima antes de mandar para o banco. Ele também lê os arquivos
`_fontes/QDD_AAAA.xls` e gera `public/data/seed-qdd.json`.

`npx tsx scripts/conferir-base.ts` é o teste de regressão dos números: refaz o cálculo da
participação do OSG sobre os seeds, quebra tudo por exercício e compara com a linha de base
escrita no topo do próprio script. Sai com **código 1** e nomeia a medida divergente quando
algo sai da linha — rode depois de qualquer troca de planilha e de qualquer mudança em
`agregacoes.ts`. O bloco `ESPERADO` do script e a tabela de *Conferência* acima são a mesma
linha de base: mudou um de propósito, mude o outro.

---

## Deploy no Vercel

1. Suba o repositório para `luisalnr/osgacre`.
2. Importe no Vercel (framework Next.js, sem configuração extra).
3. Defina as variáveis de ambiente:

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | connection string do Neon **com** pooler — usada em runtime |
| `DATABASE_URL_UNPOOLED` | connection string **sem** pooler — usada por `db:push` |
| `SESSION_SECRET` | assina o cookie de sessão do `/admin`; string aleatória longa |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | só para rodar `db:seed-admin` |

`SESSION_SECRET` é obrigatória em produção: sem ela a sessão falha na inicialização,
de propósito, para não assinar cookies com um segredo de desenvolvimento.

---

## Estrutura

```
_fontes/                  planilhas de origem (fora do git)
public/
  data/                   seeds JSON da carga inicial
  relatorios/             PDFs publicados (OSG 2024, OSG 2025, Guia)
  ilustracoes/  logos/    identidade visual
src/
  app/
    page.tsx              site institucional
    painel/               painel interativo
    admin/                login + importação (sessão lida no servidor)
    api/                  registros, qdd, leis, auth
  components/site|painel|admin|ui
  lib/
    parser-comum.ts       o que os dois parsers de registro compartilham
    parser-osg.ts         Tabela_OSG (2024-2025) -> registros, com as checagens da prévia
    parser-orcamentos-tematicos.ts
                          Relatório do Sistema de Orçamentos Temáticos (2026+) -> registros
    parser-qdd.ts         QDD .xls -> dotações agregadas por órgão/unidade/projeto
    checagens-qdd.ts      conferência da Tabela OSG contra o QDD do exercício
    parser-leis.ts        histórico de leis; lê o link do legis.ac.gov.br do hyperlink
    agregacoes.ts         agrupamento em dotações, totais, cortes por eixo/categoria
    referencias.ts        eixos da Lei 4.168/2023, categorias do Guia, funções do MTO
    cores.ts              paleta dos gráficos e as regras que ela segue
    exportar.ts           XLSX (exceljs) e PDF (jspdf), respeitando os filtros
scripts/
  build-data.ts           planilhas -> public/data/*.json
  seed-neon.ts            JSON -> Neon (carga inicial)
  seed-admin.ts           usuário do /admin
  conferir-base.ts        teste de regressão dos números, por exercício (sai 1 se divergir)
  hash-senha.ts           gera o scrypt `salt:hash` de uma senha, para o login local
  conferir-login-local.ts confere as duas guardas do login local (sai 1 se alguma abrir)
```

---

## Notas de manutenção

- **Segurança**: toda rota de escrita (`POST`/`DELETE` em `/api/registros`, `/api/qdd` e
  `/api/leis`) chama `requireSession()` antes de tocar no banco. A tela do `/admin` decidir o que
  mostrar é conveniência de interface, não a proteção.
- **Cores dos gráficos**: os gráficos por eixo ficam na ordem canônica da lei (I a VI), e
  não ordenados por valor. Além de fidelidade à norma, a separação para daltonismo foi
  validada para pares vizinhos nessa ordem. Ver o cabeçalho de `src/lib/cores.ts`.
- **Nomes dos programas do PPA**: a planilha traz só o código. `PROGRAMAS` em
  `src/lib/referencias.ts` mapeia os conhecidos; o painel mostra o código quando falta o
  nome. Acrescente ali conforme forem confirmados.
- **PDF**: as fontes padrão do jsPDF são Latin-1 e descartam em silêncio o que estiver
  fora. `paraPdf()` em `src/lib/exportar.ts` converte travessões e aspas curvas antes de
  escrever.
- **Novo exercício**: importe primeiro o **QDD** e depois o **Relatório Orçamentos
  Temáticos**, no modo **Substituir exercício** — ele apaga e regrava só os anos presentes
  no arquivo, deixando os demais intactos. A ordem importa: é o QDD que dá os nomes
  canônicos de órgão e unidade e a dotação contra a qual a participação do OSG é calculada.
  Importar antes dele não quebra nada, mas os registros ficam com os nomes como o relatório
  os escreve, e o painel fica sem percentual e sem fontes de recurso até o QDD chegar.
  Depois, acrescente o exercício a `EXERCICIOS_EM_APURACAO` enquanto a execução não fechar,
  o PDF em `public/relatorios/` e o cartão em `RELATORIOS` (`src/lib/conteudo.ts`).
- **Capa de um relatório novo**: o cartão de `#relatorios` mostra a primeira página do
  PDF, não um ícone. Rode `python scripts/capas-relatorios.py` (precisa de
  `python -m pip install pymupdf`) — ele rasteriza a página 1 de cada PDF de
  `public/relatorios/` para `public/relatorios/capas/` — e aponte o campo `capa` do
  registro para o PNG gerado. O campo é opcional: sem ele o cartão volta ao ícone
  genérico, o que é o sintoma de capa não gerada.
- **Colunas novas em `osg_registros`**: são quatro os lugares a tocar, e o quarto é fácil
  de esquecer — `schema.ts`, `types.ts`, `db/mappers.ts` (ida e volta) e o `set:` do
  `onConflictDoUpdate` em `src/app/api/registros/route.ts`, que enumera as colunas à mão.
  Faltando a última, a coluna grava na inserção e some no upsert.
- **Sem migrations**: o fluxo é `npm run db:push`. Colunas novas com `.notNull().default()`
  entram sem quebrar as linhas já gravadas. `ponderador` e `planejado_entrega` são os dois
  únicos nullable da tabela, e por significado: em ambos o vazio quer dizer alguma coisa
  ("não pondera", "não discriminado") que um zero apagaria.
- **Cache dos dados**: `src/lib/dados.ts` guarda os seeds em memória pelo tempo do processo e
  envolve as consultas ao Neon em `unstable_cache` com tag. Duas consequências práticas. Em
  produção, quem mantém a promessa de "importou, apareceu" é o `revalidateTag` das rotas de
  escrita — mexeu numa rota de escrita nova, lembre da tag. Em desenvolvimento, rodar
  `npm run data:build` com o servidor de pé **não** troca os números na tela: os seeds já estão
  em memória, e é preciso reiniciar o `npm run dev`.
- **Liquidado de 2026**: está no banco e é conferível na prévia da importação, mas não
  aparece em nenhuma superfície de leitura. Ver *Exercícios em apuração*, acima.

Fonte dos dados: DEPPO/SEPLAN — Comitê de Apuração do Orçamento Sensível ao Gênero (COSG).
