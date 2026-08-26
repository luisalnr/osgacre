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

### Granularidade

Uma linha da planilha `Tabela_OSG` é uma **entrega apropriada**. Uma **dotação**
(exercício + órgão + projeto/atividade) reúne várias entregas — o painel agrupa por
dotação e abre para mostrar as entregas.

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
   `Ini+Sup+Cor-Red (B)` do QDD.

**A regra do denominador** (`baseDotacao`, em `src/lib/agregacoes.ts`): a dotação inicial
quando ela comporta a apropriação, senão a maior entre inicial e atualizada.

- Caso comum (dotação intacta ou reduzida): usa a **inicial**, e a metodologia fecha —
  categoria 1 dá 100%, categoria 3 dá 50%.
- Remanejamento (FAPAC 2025/12190000: R$ 233 mil iniciais, R$ 8,97 mi atualizados): usa a
  **atualizada** → 57,7%.
- Emenda parlamentar (SEMULHER 2025/80285678: R$ 0 iniciais, R$ 500 mil atualizados): usa
  a **atualizada** → 100%.
- Quando nem a inicial nem a atualizada cobrem a apropriação, o painel mostra
  **"a conferir"** — são 3 dotações hoje, todas erro de registro na planilha de origem.

Usar sempre a atualizada seria errado: em 55 das 150 dotações ela é **menor** que a
inicial, porque a dotação encolheu durante o exercício.

A junção com o QDD é por `(exercício, órgão, projeto/atividade)`, com recuo para
`(exercício, projeto/atividade)` — há ações compartilhadas em que a entrega está na PMAC
mas a dotação, no QDD, aparece na SEJUSP. Não dá para usar unidade: na sigla `719/219`
o 219 não é o código de unidade do QDD.

### Conferência

Os totais batem com os relatórios publicados:

| Exercício | Entregas | Apropriado | Liquidado | Execução |
|---|---|---|---|---|
| 2024 | 82 | R$ 171.143.631,23 | R$ 114.622.947,14 | 67,0% |
| 2025 | 103 | R$ 220.468.189,96 | R$ 140.031.314,55 | 63,5% |

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

`npm run data:build` imprime os totais por exercício, categoria e eixo — use a saída para
conferir contra a tabela acima antes de mandar para o banco. Ele também lê os arquivos
`_fontes/QDD_AAAA.xls` e gera `public/data/seed-qdd.json`.

`npx tsx scripts/conferir-base.ts` refaz o cálculo da participação do OSG sobre os seeds e
lista as dotações marcadas como "a conferir" — vale rodar depois de qualquer troca de
planilha.

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
    parser-osg.ts         Tabela_OSG -> registros, com as checagens da prévia
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
  conferir-base.ts        refaz o cálculo da participação do OSG sobre os seeds
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
- **Novo exercício (2026)**: importe primeiro o **QDD** e depois a **Tabela OSG** no modo
  **Substituir exercício** — ele apaga e regrava só os anos presentes no arquivo, deixando
  2024 e 2025 intactos. Sem o QDD do exercício, a conferência das dotações não roda e a
  participação do OSG cai na reserva da planilha. Depois, acrescente o PDF em
  `public/relatorios/` e o cartão em `RELATORIOS` (`src/lib/conteudo.ts`).
- **Relatório "Orçamentos Temáticos"**: o quarto campo do `/admin` está em modo
  reconhecimento — lê o arquivo e mostra abas, cabeçalho e primeiras linhas, mas não grava
  nada. O parser será escrito quando o layout do relatório estiver definido.

Fonte dos dados: DEPPO/SEPLAN — Comitê de Apuração do Orçamento Sensível ao Gênero (COSG).
