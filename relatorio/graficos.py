"""
Gráficos do Relatório do OSG 2026, feitos a partir das exportações do painel.

    python -m pip install -r relatorio/requirements.txt
    python relatorio/graficos.py                      # lê relatorio/dados/*.xlsx
    python relatorio/graficos.py a.xlsx b.xlsx ...    # ou os arquivos indicados

A entrada é o XLSX que o painel exporta (botão "Exportar XLSX"), um arquivo por
exercício ou um só com todos — o que importa é que cada exercício apareça em UM
arquivo só, senão seria somado duas vezes, e o script para com erro nesse caso.
Os itens (a), (b) e (e) precisam de 2024, 2025 e 2026.

As famílias: (a) categorias, (b) eixos temáticos, (c) funções orçamentárias,
(d) órgãos e unidades executoras e (e) o total do exercício, sem recorte.

Lê a aba "Entregas", e não "Dotações": na aba de dotações a coluna Categoria
vem como "2, 3" nas dotações que misturam categorias, e o agrupamento quebraria.
Na aba de entregas cada linha tem exatamente uma categoria e um eixo, e a soma
devolve os totais do painel ao centavo.

Grava em `relatorio/saida/` um PNG por gráfico, o `c-tabelas-funcoes.docx` com
as tabelas por função orçamentária (item c — a função vem da aba "Dotações") e
o `dados-graficos.csv` com os números por trás de cada barra e de cada célula —
é deles que o texto do relatório deve citar — e o `notas-explicativas.docx`,
que diz o que cada figura mostra, como ler e o que ressalvar, com os destaques
calculados dos mesmos dados.

Os gráficos saem limpos, sem título nem fonte: número da figura, título e
"Fonte: DEPPO/SEPLAN" vão na legenda do Word. A largura é a útil de um A4
retrato (16 cm) a 500 dpi, para entrar no documento a 100% sem redimensionar —
assim o corpo de 8–9 pt do gráfico chega ao papel com 8–9 pt.

Para acrescentar um gráfico: escreva uma função que receba o dicionário de
`agregar()` e devolva a figura, e registre-a em `GRAFICOS`.
"""

import csv
import glob
import os
import re
import sys
from decimal import ROUND_HALF_UP, Decimal

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    from matplotlib.path import Path
    from matplotlib.patches import PathPatch, Patch, Rectangle
    from openpyxl import load_workbook
    from docx import Document
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor
except ImportError:
    sys.exit(
        "Falta o matplotlib, o openpyxl ou o python-docx. Rode: python -m pip install -r relatorio/requirements.txt"
    )

AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, "dados")
SAIDA = os.path.join(AQUI, "saida")

ABA = "Entregas"
COL_ANO = "Exercício"
COL_CAT = "Categoria"
COL_EIXO = "Eixo do OSG (Lei nº 4.168/2023)"
COL_PLAN = "Valor planejado OSG"
COL_LIQ = "Liquidado OSG"
# Os três que, com o exercício, formam a chave de dotação do painel
# (`agruparEmDotacoes` em src/lib/agregacoes.ts).
COL_ORGAO = "Órgão (cód.)"
COL_UNIDADE = "Unidade (cód.)"
COL_PROJETO = "Projeto/Atividade"
# Os nomes, para o item (d). Terminam em "- SIGLA" (ver `sigla_curta`).
COL_ORGAO_NOME = "Órgão"
COL_UNIDADE_NOME = "Unidade"
# O texto de cada dotação, para o detalhamento do item (e).
COL_APLICACAO = "Aplicação programada"

# A função orçamentária só existe na aba "Dotações" do export — a de entregas
# não a traz. Serve porque nenhuma dotação mistura funções (2024 a 2026): somar
# as dotações por função dá o mesmo que o `porFuncao` do painel.
ABA_DOTACOES = "Dotações"
ABA_RECORTE = "Recorte"
COL_FUNCAO_COD = "Função (cód.)"
COL_FUNCAO = "Função"

# Na ordem da regra (src/lib/referencias.ts), não na do valor.
CATEGORIAS = (1, 2, 3)

# Os seis eixos do art. 4º da Lei nº 4.168/2023, na ordem da lei (`EIXOS` em
# src/lib/referencias.ts) — não por valor, para a numeração romana continuar
# fazendo sentido. (romano, nome como o export escreve, nome no gráfico): só o
# eixo I não cabe numa linha.
EIXOS = (
    ("I", "Assistência Social e Direitos Humanos", "Assistência Social e\nDireitos Humanos"),
    ("II", "Educação", "Educação"),
    ("III", "Saúde", "Saúde"),
    ("IV", "Segurança", "Segurança"),
    ("V", "Econômico", "Econômico"),
    ("VI", "Governança", "Governança"),
)
EIXO_POR_NOME = {nome: romano for romano, nome, _ in EIXOS}
ROMANOS = tuple(romano for romano, _, _ in EIXOS)

# Tokens do tema claro do painel (src/app/globals.css).
TEXTO = "#14171a"
TEXTO_2 = "#4f545b"
SUPERFICIE = "#ffffff"
LINHA_DE_BASE = "#c9cdc3"

# Comparativo entre exercícios: dois passos de um mesmo hue, do claro ao escuro
# conforme o tempo avança — a mesma convenção do painel (`COR_EXERCICIO_*` em
# src/lib/cores.ts). O verde é o do planejado; o lilás, o do liquidado.
#
# Medido com o validador do skill de dataviz (rampa ordinal, fundo branco):
# os dois pares passam em todas as checagens. Passo claro contra o branco:
# verde #1baf7a 2,82:1, lilás #a584dc 3,03:1. O #a584dc não existe no painel —
# foi escolhido aqui para ficar no mesmo hue do `--lilas` e ao menos tão
# visível quanto o verde claro que o painel já aceita.
VERDE_ANTERIOR, VERDE_ATUAL = "#1baf7a", "#0b6647"
LILAS_ANTERIOR, LILAS_ATUAL = "#a584dc", "#6d3fb5"

# Cor de cada eixo, a do painel (`COR_EIXO` em src/lib/cores.ts → `--serie-1..6`
# do tema claro). Só onde o eixo é a identidade da marca — a rosca; nas barras
# por eixo a cor é do exercício, e o eixo está escrito no rótulo. Validada com
# o skill de dataviz na ordem da lei, inclusive o par VI → I que fecha o anel.
# Três delas ficam abaixo de 3:1 contra o branco, e por isso todo valor da rosca
# vem escrito na legenda.
COR_EIXO = {
    "I": "#2a78d6",
    "II": "#eb6834",
    "III": "#1baf7a",
    "IV": "#eda100",
    "V": "#e87ba4",
    "VI": "#008300",
}

LARGURA = 6.3  # polegadas: 16 cm
DPI = 500


# --------------------------------------------------------------------------- #
# Leitura e agregação
# --------------------------------------------------------------------------- #


def carregar_entregas(caminhos: list[str]) -> list[dict]:
    """Linhas da aba "Entregas" de todos os arquivos, com as colunas por nome."""
    entregas: list[dict] = []
    origem_do_ano: dict[int, str] = {}

    for caminho in caminhos:
        nome = os.path.basename(caminho)
        wb = load_workbook(caminho, read_only=True, data_only=True)
        if ABA not in wb.sheetnames:
            sys.exit(f"{nome}: não tem a aba \"{ABA}\". É uma exportação XLSX do painel?")

        linhas = wb[ABA].iter_rows(values_only=True)
        cabecalho = list(next(linhas))
        # Por nome, não por posição: as colunas do export já mudaram de lugar
        # mais de uma vez (ver o comentário do autofiltro em exportar.ts).
        try:
            i_ano, i_cat, i_eixo, i_plan, i_liq, i_org, i_uni, i_proj, i_onome, i_unome, i_apl = (
                cabecalho.index(c)
                for c in (
                    COL_ANO, COL_CAT, COL_EIXO, COL_PLAN, COL_LIQ,
                    COL_ORGAO, COL_UNIDADE, COL_PROJETO, COL_ORGAO_NOME, COL_UNIDADE_NOME, COL_APLICACAO,
                )
            )
        except ValueError as e:
            sys.exit(f"{nome}: falta uma coluna esperada na aba \"{ABA}\" ({e}).")

        anos_do_arquivo: set[int] = set()
        for n, linha in enumerate(linhas, start=2):
            if linha[i_ano] is None:
                continue
            ano = int(linha[i_ano])
            cat = int(str(linha[i_cat]).strip())
            if cat not in CATEGORIAS:
                sys.exit(f"{nome}, linha {n}: categoria \"{linha[i_cat]}\" fora de 1, 2 ou 3.")
            eixo = EIXO_POR_NOME.get(str(linha[i_eixo]).strip())
            if eixo is None:
                sys.exit(f"{nome}, linha {n}: eixo \"{linha[i_eixo]}\" não é um dos seis da Lei nº 4.168/2023.")
            entregas.append(
                {
                    "ano": ano,
                    "cat": cat,
                    "eixo": eixo,
                    "plan": float(linha[i_plan] or 0),
                    # Vazio no exercício em apuração: o export não escreve
                    # liquidado parcial, e aqui ele continua vazio.
                    "liq": None if linha[i_liq] is None else float(linha[i_liq]),
                    # Chave da dotação, como a do painel. O export grava célula
                    # vazia onde o painel tem "", e sem normalizar a mesma
                    # dotação teria duas chaves.
                    "dot": tuple(str(linha[i] or "").strip() for i in (i_org, i_uni, i_proj)),
                    # Órgão e par órgão/unidade ("721/607"), a `chaveUnidade`
                    # do painel — o código da unidade só é único dentro do órgão.
                    "orgao": str(linha[i_org] or "").strip(),
                    "unidade": f"{str(linha[i_org] or '').strip()}/{str(linha[i_uni] or '').strip()}",
                    "orgao_nome": str(linha[i_onome] or "").strip(),
                    "unidade_nome": str(linha[i_unome] or "").strip(),
                    "aplicacao": str(linha[i_apl] or "").strip(),
                }
            )
            anos_do_arquivo.add(ano)
        wb.close()

        for ano in anos_do_arquivo:
            if ano in origem_do_ano:
                sys.exit(
                    f"O exercício {ano} está em dois arquivos ({origem_do_ano[ano]} e {nome}) "
                    "e seria somado duas vezes. Deixe um só."
                )
            origem_do_ano[ano] = nome

    for ano in sorted(origem_do_ano):
        print(f"  {ano}: {origem_do_ano[ano]}")
    return entregas


def carregar_dotacoes(caminhos: list[str]) -> tuple[dict[tuple, tuple[str, str]], dict[tuple, dict], list[str]]:
    """
    A função de cada dotação, lida da aba "Dotações".

    Devolve três coisas:
      - {(ano, chave da dotação): (código, nome da função)}, para `somar_por_funcao`;
      - a aba somada por função, {(ano, código): {"plan", "liq"}}, só para a
        checagem cruzada com a aba "Entregas";
      - as datas de exportação ("Gerado em" da aba "Recorte"), para a linha de
        fonte das tabelas.

    A checagem de exercício repetido já foi feita por `carregar_entregas`, sobre
    os mesmos arquivos.
    """
    mapa: dict[tuple, tuple[str, str]] = {}
    funcoes: dict[tuple, dict] = {}
    datas: set[str] = set()
    for caminho in caminhos:
        nome = os.path.basename(caminho)
        wb = load_workbook(caminho, read_only=True, data_only=True)
        if ABA_DOTACOES not in wb.sheetnames:
            sys.exit(f"{nome}: não tem a aba \"{ABA_DOTACOES}\". É uma exportação XLSX do painel?")
        linhas = wb[ABA_DOTACOES].iter_rows(values_only=True)
        cabecalho = list(next(linhas))
        try:
            i_ano, i_cod, i_nome, i_plan, i_liq, i_org, i_uni, i_proj = (
                cabecalho.index(c)
                for c in (COL_ANO, COL_FUNCAO_COD, COL_FUNCAO, COL_PLAN, COL_LIQ, COL_ORGAO, COL_UNIDADE, COL_PROJETO)
            )
        except ValueError as e:
            sys.exit(f"{nome}: falta uma coluna esperada na aba \"{ABA_DOTACOES}\" ({e}).")
        for n, linha in enumerate(linhas, start=2):
            if linha[i_ano] is None:
                continue
            ano = int(linha[i_ano])
            cod = str(linha[i_cod] or "").strip()
            if not cod:
                sys.exit(f"{nome}, aba \"{ABA_DOTACOES}\", linha {n}: dotação sem função.")
            # A mesma normalização da chave em `carregar_entregas`.
            dot = tuple(str(linha[i] or "").strip() for i in (i_org, i_uni, i_proj))
            mapa[(ano, dot)] = (cod, str(linha[i_nome] or "").strip())
            f = funcoes.setdefault((ano, cod), {"plan": 0.0, "liq": 0.0})
            f["plan"] += float(linha[i_plan] or 0)
            f["liq"] = None if linha[i_liq] is None or f["liq"] is None else f["liq"] + float(linha[i_liq])
        if ABA_RECORTE in wb.sheetnames:
            for linha in wb[ABA_RECORTE].iter_rows(values_only=True):
                if linha and linha[0] == "Gerado em" and linha[1]:
                    datas.add(str(linha[1]).split(",")[0].strip())
        wb.close()
    return mapa, funcoes, sorted(datas)


def somar_por_funcao(entregas: list[dict], mapa: dict[tuple, tuple[str, str]]) -> dict[tuple, dict]:
    """
    {(ano, código): {"nome", "plan", "liq", "n"}}, somando ENTREGA a entrega.

    Somar as linhas da aba "Dotações" daria o mesmo dinheiro por outro caminho,
    e o caminho importa no meio centavo do rateio: a Assistência Social de 2024
    é exatamente 2.612.588,825, o painel (`porFuncao`, que soma registros) chega
    a ...,82499999 e mostra ,82, e a soma por dotação dava ,83. Seguindo a ordem
    do painel, a tabela mostra o mesmo centavo que a tela.
    """
    funcoes: dict[tuple, dict] = {}
    dots: dict[tuple, set] = {}
    for e in entregas:
        achado = mapa.get((e["ano"], e["dot"]))
        if achado is None:
            sys.exit(f"{e['ano']} {'/'.join(e['dot'])}: entrega sem dotação correspondente na aba \"{ABA_DOTACOES}\".")
        cod, nome = achado
        f = funcoes.setdefault((e["ano"], cod), {"nome": nome, "plan": 0.0, "liq": 0.0})
        f["plan"] += e["plan"]
        f["liq"] = None if e["liq"] is None or f["liq"] is None else f["liq"] + e["liq"]
        dots.setdefault((e["ano"], cod), set()).add(e["dot"])
    for k, f in funcoes.items():
        f["n"] = len(dots[k])
    return funcoes


def totais_do_ano(entregas: list[dict], ano: int) -> tuple[float, float | None]:
    """
    Planejado e liquidado do exercício, com a conta do `calcularTotais` do painel.

    Entrega a entrega, na ordem do arquivo, com soma simples de ponto flutuante.
    O rateio deixa meio centavo em algumas entregas, e o liquidado de 2025 é
    exatamente 140.031.314,555. O painel chega a ...,55499998 e publica ,55; o
    `sum()` do Python 3.12+ compensa o erro, chega ao ,555 exato e arredonda
    para ,56. Aqui vale o número que o painel publica.
    """
    plan, liq = 0.0, 0.0
    for e in entregas:
        if e["ano"] != ano:
            continue
        plan += e["plan"]
        liq = None if e["liq"] is None or liq is None else liq + e["liq"]
    return plan, liq


def conferir_abas(entregas: list[dict], funcoes: dict[tuple, dict]) -> None:
    """
    As abas "Entregas" e "Dotações" saem da mesma exportação e têm de fechar o
    mesmo total por exercício. Se não fecharem, alguma coisa mudou no export — e
    as tabelas por função não podem sair com um total diferente dos gráficos.
    """
    for ano in sorted({e["ano"] for e in entregas}):
        plan_e, liq_e = totais_do_ano(entregas, ano)
        do_ano = [f for (a, _), f in funcoes.items() if a == ano]
        plan_d = sum(f["plan"] for f in do_ano)
        liq_d = None if any(f["liq"] is None for f in do_ano) else sum(f["liq"] for f in do_ano)
        # Um centavo de tolerância: são as mesmas parcelas somadas em ordem
        # diferente, e o meio centavo do rateio pode cair para um lado ou outro.
        if abs(plan_e - plan_d) >= 0.01 or (liq_e is None) != (liq_d is None) or (
            liq_e is not None and abs(liq_e - liq_d) >= 0.01
        ):
            sys.exit(
                f"{ano}: a aba \"{ABA_DOTACOES}\" não fecha com a aba \"{ABA}\" "
                f"(planejado {reais(plan_d)} × {reais(plan_e)}). Exporte o exercício de novo."
            )


def somar(entregas: list[dict], por: str) -> dict[tuple, dict]:
    """{(ano, grupo): {"plan", "liq"}}, por "cat" ou "eixo". `liq` é None se algum valor faltar."""
    grupos: dict[tuple, dict] = {}
    for e in entregas:
        g = grupos.setdefault((e["ano"], e[por]), {"plan": 0.0, "liq": 0.0})
        g["plan"] += e["plan"]
        if e["liq"] is None or g["liq"] is None:
            g["liq"] = None
        else:
            g["liq"] += e["liq"]
    return grupos


def contar_dotacoes(entregas: list[dict], por: str) -> dict[tuple, dict]:
    """
    {(ano, grupo): {"n": dotações}}, por "cat" ou "eixo".

    Conta dotações distintas, não entregas — a dotação é a chave do painel, e
    contar linhas daria um número sem significado orçamentário. Uma dotação
    conta em cada grupo em que tem entrega, a mesma regra do painel
    (`dotacoesPorEixoEAno`): em 2025, duas têm entregas nas categorias 2 e 3 e
    entram nas duas; em 2024, a SEOP 754/001, ação 11000000, entra nos eixos I
    e VI. Por isso a soma dos grupos pode passar do total do exercício.
    """
    vistos: dict[tuple, set] = {}
    for e in entregas:
        vistos.setdefault((e["ano"], e[por]), set()).add(e["dot"])
    return {k: {"n": len(v)} for k, v in vistos.items()}


def agregar(entregas: list[dict]) -> dict[str, dict]:
    return {
        "cat": somar(entregas, "cat"),
        "eixo": somar(entregas, "eixo"),
        "dot_cat": contar_dotacoes(entregas, "cat"),
        "dot_eixo": contar_dotacoes(entregas, "eixo"),
        "orgao": somar(entregas, "orgao"),
        "unidade": somar(entregas, "unidade"),
        "dot_orgao": contar_dotacoes(entregas, "orgao"),
        "dot_unidade": contar_dotacoes(entregas, "unidade"),
        # O nome do exercício mais recente vence, como no painel (`porOrgao`).
        "nomes_orgao": {e["orgao"]: e["orgao_nome"] for e in entregas},
        "nomes_unidade": {e["unidade"]: e["unidade_nome"] for e in entregas},
        # Por dotação, para a Tabela 6 — a chave `dot` é a do painel.
        "dot": somar(entregas, "dot"),
        **_aplicacoes(entregas),
    }


def _aplicacoes(entregas: list[dict]) -> dict[str, dict | set]:
    """
    A aplicação programada de cada dotação, {(ano, dot): texto}, e as dotações
    em que as entregas trazem textos diferentes.

    Vale o texto da primeira entrega, como no `agruparEmDotacoes` do painel. O
    conflito é guardado em vez de parar o script aqui: em 2024 e 2026 ele não
    importa, e a Tabela 6 — a única que usa o texto — confere o de 2025.
    """
    textos: dict[tuple, str] = {}
    conflitos: set[tuple] = set()
    for e in entregas:
        k = (e["ano"], e["dot"])
        if textos.setdefault(k, e["aplicacao"]) != e["aplicacao"]:
            conflitos.add(k)
    return {"aplicacao": textos, "aplicacao_conflito": conflitos}


def exigir(somas: dict, grupos: tuple, anos: tuple[int, ...], medida: str, grafico: str, nome) -> None:
    """
    Falha com mensagem clara em vez de desenhar barra vazia.

    Um grupo sem nenhuma entrega num ano também para o script: um eixo vazio é
    muito mais provável que seja erro de classificação do que zero de verdade —
    foi assim que Governança apareceu sem dotação em 2026, até o relatório de
    origem ser corrigido em 11/09/2026.
    """
    for ano in anos:
        for grupo in grupos:
            g = somas.get((ano, grupo))
            if g is None:
                sys.exit(
                    f"{grafico}: {nome(grupo)} não tem nenhuma entrega em {ano} na exportação. "
                    "Se o exercício foi exportado, confira a classificação antes de publicar."
                )
            if g[medida] is None:
                sys.exit(
                    f"{grafico}: o liquidado de {ano} está vazio na exportação — o exercício "
                    "ainda está em apuração no painel."
                )


# --------------------------------------------------------------------------- #
# Formatos pt-BR (sem depender do locale do sistema)
# --------------------------------------------------------------------------- #


def _br(v: float, casas: int) -> str:
    if casas == 2:
        # Centavos arredondados como o painel: o `toLocaleString` parte da menor
        # representação decimal do número ("28174611.215") e desempata para
        # longe do zero (,22). O `:.2f` do Python arredonda o binário exato
        # (…,2149999) e daria ,21 — um centavo de diferença contra a tela em
        # quatro células das tabelas por função.
        v = Decimal(repr(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{v:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def reais(v: float) -> str:
    return _br(v, 2)


def mi(v: float) -> str:
    return f"R$ {_br(v / 1e6, 1)} mi"


def sigla_curta(nome: str) -> str:
    """
    A sigla no fim do nome ("… - SESACRE" → "SESACRE"), ou o nome inteiro.

    Porte do `siglaCurta` do painel (src/lib/orgaos.ts), com a mesma expressão:
    só vale como sigla o trecho curto e sem espaço depois do último hífen — "-
    COHAB/ACRE" serve, "- FOLHA DE PAGAMENTO DE PESSOAL" é continuação do nome.
    O painel passa antes pelo `limparNome`; aqui não precisa, porque o nome já
    sai limpo na exportação.
    """
    limpo = nome.strip()
    m = re.search(r"-\s*([^-]{2,20})$", limpo)
    sigla = m.group(1).strip() if m else ""
    return sigla if sigla and " " not in sigla else limpo


def valor_curto(v: float) -> str:
    """
    "R$ 69,5 mi", "R$ 364 mil" ou "R$ 0" — para os gráficos por função, onde há
    valores de R$ 13 mil que o `mi()` escreveria "R$ 0,0 mi". Os gráficos por
    categoria e eixo continuam com `mi()`: nenhum valor deles fica abaixo de
    R$ 0,8 mi, e trocar ali mudaria figuras já entregues.
    """
    if v >= 1e6:
        return mi(v)
    if v >= 1e3:
        return f"R$ {_br(v / 1e3, 0)} mil"
    return f"R$ {_br(v, 0)}"


def pct(v: float, sinal: bool = False) -> str:
    texto = f"{_br(abs(v), 1)}%"
    if not sinal:
        return texto
    return ("+" if v >= 0 else "−") + texto


# --------------------------------------------------------------------------- #
# Estilo e marcas
# --------------------------------------------------------------------------- #


def fonte_disponivel() -> str:
    """
    A primeira fonte instalada da lista.

    Resolvida uma vez aqui porque, passada como lista ao matplotlib, cada texto
    tenta a primeira e reclama no console quando ela falta — centenas de avisos
    por gráfico. Inter é a fonte do painel; Segoe UI existe em todo Windows e
    tem o peso 600 que os valores usam.
    """
    instaladas = {f.name for f in font_manager.fontManager.ttflist}
    for nome in ("Inter", "Segoe UI", "Arial"):
        if nome in instaladas:
            return nome
    return "DejaVu Sans"


def aplicar_estilo() -> None:
    plt.rcParams.update(
        {
            "font.family": fonte_disponivel(),
            "font.size": 8.5,
            "text.color": TEXTO,
            "figure.facecolor": SUPERFICIE,
            "axes.facecolor": SUPERFICIE,
            "savefig.facecolor": SUPERFICIE,
        }
    )


def barra(ax, y: float, espessura: float, valor: float, cor: str, raio_pol: float = 0.035) -> None:
    """
    Barra horizontal com a ponta direita arredondada e a base reta, no zero.

    O raio é dado em polegadas e convertido para unidades de dado em cada eixo
    separadamente — os dois eixos têm escalas diferentes, e um raio em unidades
    de dado sairia elíptico. Por isso os limites do eixo precisam estar fixados
    antes da primeira chamada.
    """
    if valor <= 0:
        return
    caixa = ax.bbox.transformed(ax.figure.dpi_scale_trans.inverted())
    (x0, x1), (y0, y1) = ax.get_xlim(), ax.get_ylim()
    rx = min(raio_pol * abs(x1 - x0) / caixa.width, valor)
    ry = min(raio_pol * abs(y1 - y0) / caixa.height, espessura / 2)
    b, t = y - espessura / 2, y + espessura / 2
    vertices = [
        (0, b), (valor - rx, b),
        (valor, b), (valor, b + ry),
        (valor, t - ry),
        (valor, t), (valor - rx, t),
        (0, t), (0, b),
    ]
    codigos = [
        Path.MOVETO, Path.LINETO,
        Path.CURVE3, Path.CURVE3,
        Path.LINETO,
        Path.CURVE3, Path.CURVE3,
        Path.LINETO, Path.CLOSEPOLY,
    ]
    ax.add_patch(PathPatch(Path(vertices, codigos), facecolor=cor, edgecolor="none", zorder=3))


def barras_agrupadas(
    grupos: list[tuple[str, str | None]],
    series: list[tuple[str, str, list[float]]],
    rotulos: list[list[tuple[str, str]]],
    altura: float = 3.6,
    com_legenda: bool = True,
    espessura_pol: float = 0.24,
):
    """
    Barras horizontais agrupadas, uma série por exercício.

    Horizontais porque cada barra leva um rótulo de uma linha na ponta ("R$ 53,0
    mi · 87,3% do planejado"): em colunas verticais esse texto é mais largo que a
    coluna e invade a vizinha. Deitadas, o rótulo tem a linha inteira para si.

    `grupos`: (título, nome ou None) de cada grupo, de cima para baixo.
    `series`: (legenda, cor, valores por grupo), na ordem em que aparecem em cada
    grupo. `rotulos`: para cada série, (valor, complemento) de cada barra — o
    valor em semibold, o complemento em cinza — é ali, na barra do exercício
    mais recente, que vai a variação dos comparativos: junto do que o olho já
    está lendo, e não sob o nome do grupo, onde ela desalinhava os rótulos.
    `altura`: da figura, em polegadas; a largura é fixa.
    `com_legenda`: False para uma série só — uma cor não precisa de caixa de
    legenda, a legenda do Word já diz o que está plotado —, e aí a faixa
    reservada a ela no topo encolhe.

    Todo valor já está escrito na ponta da barra, então o eixo X, com tiques e
    grade, sairia sem ter o que dizer — fica só a linha de base no zero.
    """
    # Tamanho fixo, e não bbox_inches="tight": o PNG precisa sair sempre com a
    # mesma largura, senão cada figura entra no Word com um tamanho.
    fig = plt.figure(figsize=(LARGURA, altura), dpi=DPI)
    # Margens em polegadas, convertidas para fração: com a altura variando por
    # gráfico, uma fração fixa daria respiros diferentes em cada um.
    base, topo = 0.11 / altura, 1 - (0.47 if com_legenda else 0.2) / altura
    ax = fig.add_axes((0.25, base, 0.72, topo - base))  # a esquerda é recalculada abaixo
    render = fig.canvas.get_renderer()
    px_pt = DPI / 72

    n = len(series)
    ax.set_ylim(len(grupos) - 0.5, -0.5)  # o primeiro grupo em cima
    # Espessura e respiro em polegadas, para as barras saírem iguais em gráficos
    # de alturas e números de grupos diferentes.
    pol_por_grupo = ax.bbox.height / DPI / len(grupos)
    espessura = espessura_pol / pol_por_grupo
    vao = 0.025 / pol_por_grupo  # o respiro entre as barras do grupo, na cor do fundo
    desloc = [(i - (n - 1) / 2) * (espessura + vao) for i in range(n)]

    # 1. Rótulo de cada grupo, à esquerda do eixo: título e nome, empilhados e
    #    centrados no grupo pela altura de cada linha. A margem
    #    esquerda sai da largura medida do maior rótulo, e não de um número a olho.
    blocos = []
    for i, (titulo, nome) in enumerate(grupos):
        partes = [(titulo, dict(fontsize=8.5, fontweight=600, color=TEXTO))]
        if nome:
            partes.append((nome, dict(fontsize=8.5, color=TEXTO)))
        blocos.append((i, partes))

    nomes = []
    for i, partes in blocos:
        alturas = [estilo["fontsize"] * 1.25 * (texto.count("\n") + 1) for texto, estilo in partes]
        cursor = (sum(alturas) + 1.5 * (len(partes) - 1)) / 2
        for (texto, estilo), h in zip(partes, alturas):
            nomes.append(
                ax.annotate(
                    texto, xy=(0, i), xycoords=("axes fraction", "data"), xytext=(-10, cursor),
                    textcoords="offset points", ha="right", va="top", multialignment="right",
                    linespacing=1.1, **estilo,
                )
            )
            cursor -= h + 1.5
    largura_nomes = max(t.get_window_extent(render).width for t in nomes)
    esquerda = (largura_nomes + 14 * px_pt) / fig.bbox.width
    ax.set_position((esquerda, base, 0.97 - esquerda, topo - base))

    # 2. Rótulos na ponta de cada barra, ancorados no valor. O limite do eixo X
    #    sai da largura medida de cada rótulo: o maior valor precisa deixar, à
    #    direita da barra, espaço para o próprio texto.
    folga_pt = 4
    medidas = []  # (valor, largura do rótulo em px)
    # Limite provisório só para medir: com o padrão (0, 1), um rótulo ancorado
    # em 162 milhões cai a bilhões de pixels da tela e a medida sai errada.
    ax.set_xlim(0, max(v for _, _, valores in series for v in valores))
    for (_, _, valores), dy, textos in zip(series, desloc, rotulos):
        for i, (v, (valor_txt, compl_txt)) in enumerate(zip(valores, textos)):
            if not valor_txt:
                # Barra que não existe (a função não teve dotação no ano): só o
                # complemento, em cinza, junto da linha de base.
                t1 = ax.annotate(
                    compl_txt, (v, i + dy), xytext=(folga_pt, 0), textcoords="offset points",
                    ha="left", va="center", fontsize=7.5, color=TEXTO_2,
                )
                medidas.append((v, t1.get_window_extent(render).width))
                continue
            t1 = ax.annotate(
                valor_txt, (v, i + dy), xytext=(folga_pt, 0), textcoords="offset points",
                ha="left", va="center", fontsize=8, fontweight=600, color=TEXTO,
            )
            partes = [t1]
            if compl_txt:
                partes.append(
                    ax.annotate(
                        compl_txt, (1, 0.5), xycoords=t1, xytext=(3, 0), textcoords="offset points",
                        ha="left", va="center", fontsize=7.5, color=TEXTO_2,
                    )
                )
            larg = sum(p.get_window_extent(render).width for p in partes) + 3 * px_pt
            medidas.append((v, larg))

    # `ax.bbox`, e não `ax.get_window_extent()`: este inclui os textos
    # anotados que passam da área de dados, e a conta errava para menos.
    largura_eixo = ax.bbox.width
    xmax = max(v * largura_eixo / (largura_eixo - folga_pt * px_pt - larg - 2 * px_pt) for v, larg in medidas)
    ax.set_xlim(0, xmax)

    # 3. As barras, só agora: o arredondamento depende dos limites finais.
    for (_, cor, valores), dy in zip(series, desloc):
        for i, v in enumerate(valores):
            barra(ax, i + dy, espessura, v, cor)

    ax.set_xticks([])
    ax.set_yticks([])
    for lado in ("top", "right", "bottom"):
        ax.spines[lado].set_visible(False)
    ax.spines["left"].set_color(LINHA_DE_BASE)
    ax.spines["left"].set_linewidth(0.8)

    if not com_legenda:
        return fig
    # Legenda acima das barras, alinhada à linha de base: dentro da área de
    # dados ela disputaria espaço com os rótulos.
    fig.legend(
        handles=[Patch(facecolor=cor, label=legenda) for legenda, cor, _ in series],
        loc="lower left",
        bbox_to_anchor=(esquerda, topo + 0.16 / altura),
        ncol=n,
        frameon=False,
        fontsize=8.5,
        handlelength=1.1,
        handleheight=1.1,
        handletextpad=0.5,
        columnspacing=1.6,
        borderaxespad=0,
        borderpad=0,
    )
    return fig


def rosca(
    fatias: list[tuple[str, str, str, float, tuple[str, str]]],
    centro: tuple[str, str],
    altura: float = 3.6,
):
    """
    Rosca de parte-do-todo com a legenda escrita à direita.

    `fatias`: (título, nome, cor, valor, (rótulo, complemento)), na ordem em que
    entram a partir do meio-dia, no sentido horário. `centro`: (rótulo em cinza,
    valor em destaque) no furo da rosca.

    Nenhum texto sobre as fatias: a menor pode ter dois graus, e um rótulo
    espremido ali sairia cortado. Cada valor está por extenso na legenda, que é
    o que garante a leitura sem depender da cor (três cores do painel ficam
    abaixo de 3:1 contra o branco).
    """
    fig = plt.figure(figsize=(LARGURA, altura), dpi=DPI)
    diametro, margem = 2.9, 0.15  # polegadas
    ax = fig.add_axes((margem / LARGURA, (altura - diametro) / 2 / altura, diametro / LARGURA, diametro / altura))
    polegada = fig.dpi_scale_trans  # para posicionar a legenda em polegadas

    ax.pie(
        [f[3] for f in fatias],
        colors=[f[2] for f in fatias],
        startangle=90,
        counterclock=False,
        # O contorno na cor do fundo é o respiro de 2 px entre as fatias, não
        # uma borda: não acrescenta tinta, só separa.
        wedgeprops=dict(width=0.42, edgecolor=SUPERFICIE, linewidth=1.5),
    )
    ax.set_aspect("equal")
    ax.text(0, 0.06, centro[0], ha="center", va="bottom", fontsize=7.5, color=TEXTO_2)
    ax.text(0, 0.0, centro[1], ha="center", va="top", fontsize=11, fontweight=600, color=TEXTO)

    # Legenda: amostra de cor + "Eixo I · nome" na primeira linha, e o valor
    # (semibold) com o complemento (cinza) na segunda. Texto sempre em tinta de
    # texto; a identidade vem da amostra ao lado, nunca do texto colorido.
    x = margem + diametro + 0.4
    passo = (8 * 1.25 + 8 * 1.25 + 7) / 72  # duas linhas e o respiro, em polegadas
    y = altura / 2 + passo * len(fatias) / 2
    for titulo, nome, cor, _, (valor_txt, compl_txt) in fatias:
        lado = 0.09
        # O quadrado centrado na primeira linha (8 pt de corpo, meio a 5 pt do topo).
        fig.add_artist(Rectangle((x, y - 5 / 72 - lado / 2), lado, lado, facecolor=cor, edgecolor="none", transform=polegada))
        ax.annotate(
            f"{titulo} · {nome}", (x + 0.17, y), xycoords=polegada, ha="left", va="top", fontsize=8, color=TEXTO,
            annotation_clip=False,
        )
        t1 = ax.annotate(
            valor_txt, (x + 0.17, y - 10.5 / 72), xycoords=polegada, ha="left", va="top", fontsize=8,
            fontweight=600, color=TEXTO, annotation_clip=False,
        )
        ax.annotate(
            compl_txt, (1, 0.5), xycoords=t1, xytext=(3, 0), textcoords="offset points", ha="left", va="center",
            fontsize=7.5, color=TEXTO_2, annotation_clip=False,
        )
        y -= passo
    return fig


# --------------------------------------------------------------------------- #
# Gráficos
# --------------------------------------------------------------------------- #

GRUPOS_CATEGORIA = [(f"Categoria {c}", None) for c in CATEGORIAS]
GRUPOS_EIXO = [(f"Eixo {romano}", rotulo) for romano, _, rotulo in EIXOS]
ALTURA_EIXOS = 5.8  # seis grupos: a mesma espessura de barra das categorias, com respiro


def nome_categoria(c) -> str:
    return f"a categoria {c}"


def nome_eixo(romano) -> str:
    return next(f"o eixo {r} ({nome})" for r, nome, _ in EIXOS if r == romano)


def comparar_planejado(somas, grupos_chave, grupos, anos, grafico, nome, altura):
    """Planejado de dois exercícios, com a variação na barra do mais recente."""
    exigir(somas, grupos_chave, anos, "plan", grafico, nome)
    antes = [somas[(anos[0], g)]["plan"] for g in grupos_chave]
    depois = [somas[(anos[1], g)]["plan"] for g in grupos_chave]
    return barras_agrupadas(
        grupos,
        [(str(anos[0]), VERDE_ANTERIOR, antes), (str(anos[1]), VERDE_ATUAL, depois)],
        [
            [(mi(v), "") for v in antes],
            # A variação é a leitura que o comparativo existe para dar.
            [(mi(d), f"· {pct((d / a - 1) * 100, sinal=True)}") for a, d in zip(antes, depois)],
        ],
        altura=altura,
    )


def comparar_execucao(somas, grupos_chave, grupos, anos, grafico, nome, altura):
    """Liquidado de dois exercícios, com a taxa de execução ao lado do valor."""
    exigir(somas, grupos_chave, anos, "liq", grafico, nome)
    series, rotulos = [], []
    for ano, cor in zip(anos, (LILAS_ANTERIOR, LILAS_ATUAL)):
        liq = [somas[(ano, g)]["liq"] for g in grupos_chave]
        plan = [somas[(ano, g)]["plan"] for g in grupos_chave]
        series.append((str(ano), cor, liq))
        # Sem teto em 100%: há grupos que liquidaram mais do que planejaram
        # (categoria 1 em 2024, Segurança em 2024 e 2025), e o gráfico mostra o
        # dado como ele é.
        rotulos.append([(mi(l), f"· {pct(l / p * 100)} do planejado") for l, p in zip(liq, plan)])
    return barras_agrupadas(grupos, series, rotulos, altura=altura)


def comparar_contagem(contagens, grupos_chave, grupos, anos, grafico, nome, altura):
    """Número de dotações de dois exercícios, com a variação na barra do mais recente."""
    exigir(contagens, grupos_chave, anos, "n", grafico, nome)
    antes = [contagens[(anos[0], g)]["n"] for g in grupos_chave]
    depois = [contagens[(anos[1], g)]["n"] for g in grupos_chave]

    def variacao(a: int, d: int) -> str:
        # A diferença absoluta vem primeiro: com contagens pequenas (Governança
        # tem uma dotação), o percentual sozinho exagera ou esconde o que mudou.
        if d == a:
            return "· sem variação"
        dif = d - a
        return f"· {'+' if dif > 0 else '−'}{abs(dif)} ({pct((d / a - 1) * 100, sinal=True)})"

    return barras_agrupadas(
        grupos,
        # Verde, como o gráfico de dotações do painel: são dotações planejadas.
        [(str(anos[0]), VERDE_ANTERIOR, antes), (str(anos[1]), VERDE_ATUAL, depois)],
        [[(str(v), "") for v in antes], [(str(d), variacao(a, d)) for a, d in zip(antes, depois)]],
        altura=altura,
    )


def grafico_planejado_categoria(dados):
    """(a.1) Valor planejado OSG por categoria, 2025 × 2026."""
    return comparar_planejado(
        dados["cat"], CATEGORIAS, GRUPOS_CATEGORIA, (2025, 2026), "Planejado por categoria", nome_categoria, 3.6
    )


def grafico_execucao_categoria(dados):
    """(a.2) Liquidado OSG por categoria, 2024 × 2025, com a taxa de execução."""
    return comparar_execucao(
        dados["cat"], CATEGORIAS, GRUPOS_CATEGORIA, (2024, 2025), "Execução por categoria", nome_categoria, 3.6
    )


def grafico_execucao_eixo(dados):
    """(b.1) Liquidado OSG por eixo, 2024 × 2025, com a taxa de execução."""
    return comparar_execucao(
        dados["eixo"], ROMANOS, GRUPOS_EIXO, (2024, 2025), "Execução por eixo", nome_eixo, ALTURA_EIXOS
    )


def grafico_planejado_eixo(dados):
    """(b.2) Valor planejado OSG por eixo, 2025 × 2026."""
    return comparar_planejado(
        dados["eixo"], ROMANOS, GRUPOS_EIXO, (2025, 2026), "Planejado por eixo", nome_eixo, ALTURA_EIXOS
    )


def grafico_dotacoes_categoria(dados):
    """(a.3) Número de dotações planejadas por categoria, 2025 × 2026."""
    return comparar_contagem(
        dados["dot_cat"], CATEGORIAS, GRUPOS_CATEGORIA, (2025, 2026), "Dotações por categoria", nome_categoria, 3.6
    )


def grafico_dotacoes_eixo(dados):
    """(b.3) Número de dotações planejadas por eixo, 2025 × 2026."""
    return comparar_contagem(
        dados["dot_eixo"], ROMANOS, GRUPOS_EIXO, (2025, 2026), "Dotações por eixo", nome_eixo, ALTURA_EIXOS
    )


def distribuicao(somas, grupos_chave, ano, medida, grafico, nome):
    """[(grupo, valor, % do total)] na ordem dos grupos, e o total do exercício."""
    exigir(somas, grupos_chave, (ano,), medida, grafico, nome)
    valores = [somas[(ano, g)][medida] for g in grupos_chave]
    total = 0.0
    for v in valores:
        total += v
    return [(g, v, v / total * 100) for g, v in zip(grupos_chave, valores)], total


def grafico_distribuicao_eixo_barras(dados):
    """(b.4) Participação de cada eixo no liquidado de 2025, em barras."""
    dist, _ = distribuicao(dados["eixo"], ROMANOS, 2025, "liq", "Distribuição do liquidado por eixo", nome_eixo)
    return barras_agrupadas(
        GRUPOS_EIXO,
        # O lilás escuro é o de 2025 no b1: o mesmo exercício, a mesma cor.
        [("2025", LILAS_ATUAL, [p for _, _, p in dist])],
        [[(pct(p), f"· {mi(v)}") for _, v, p in dist]],
        # Uma barra por eixo: com a espessura fixa das barras, 5,8 pol. deixaria
        # mais vão do que barra.
        altura=4.2,
        com_legenda=False,
    )


def grafico_distribuicao_eixo_rosca(dados):
    """(b.5) Participação de cada eixo no liquidado de 2025, em rosca."""
    dist, total = distribuicao(dados["eixo"], ROMANOS, 2025, "liq", "Distribuição do liquidado por eixo", nome_eixo)
    nomes = {romano: nome for romano, nome, _ in EIXOS}
    return rosca(
        [(f"Eixo {r}", nomes[r], COR_EIXO[r], v, (pct(p), f"· {mi(v)}")) for r, v, p in dist],
        ("Liquidado 2025", mi(total)),
    )


# Por função orçamentária (item c). São 12 a 16 funções por gráfico, e com a
# espessura das categorias e eixos a figura passaria de uma página A4: aqui a
# barra é mais fina e a altura acompanha o número de funções.
ESPESSURA_FUNCAO = 0.14  # polegadas por barra
# Planejado × liquidado do mesmo exercício: verde e lilás, a convenção do painel
# (`COR_APROPRIADO`/`COR_LIQUIDADO` em src/lib/cores.ts). Par medido no
# validador: ΔE 27,6 sob deuteranopia; o verde fica abaixo de 3:1 contra o
# branco, e por isso todo valor vai escrito na ponta da barra.
COR_PLANEJADO, COR_LIQUIDADO = VERDE_ANTERIOR, LILAS_ATUAL
SEM_DOTACAO = ("", "sem dotação")  # rótulo da barra que não existe no ano


def _altura_funcoes(n: int) -> float:
    return 0.58 + n * 0.46


def _grupos_funcao(dados, codigos) -> list[tuple[str, None]]:
    return [(f"{c} {dados['nomes_funcao'][c]}", None) for c in codigos]


def _exigir_liquidado(somas: dict, anos: tuple[int, ...], grafico: str) -> None:
    """
    Grupo sem dotação no ano é dado (funções, órgãos); liquidado vazio é
    exercício em apuração, e aí o gráfico ou a tabela não pode sair.
    """
    if any(g["liq"] is None for (a, _), g in somas.items() if a in anos):
        sys.exit(f"{grafico}: o liquidado de {anos} está vazio na exportação — exercício ainda em apuração.")


def comparar_planejado_opcional(valores: list[tuple[float | None, float | None]], grupos):
    """
    Planejado 2025 × 2026 de grupos que podem faltar num dos anos — funções e
    órgãos, onde a ausência é dado e não erro (o contrário dos eixos, que usam
    `exigir`). `valores`: (planejado 2025, planejado 2026) na ordem de `grupos`,
    com None onde o grupo não existe no exercício.
    """

    def rotulo_2026(a, d) -> tuple[str, str]:
        # Sem 2026, o "sem dotação" da barra já diz tudo; sem 2025, não há de
        # onde calcular variação e o grupo é novo.
        if d is None:
            return SEM_DOTACAO
        if not a:
            return valor_curto(d), "· nova em 2026"
        return valor_curto(d), f"· {pct((d / a - 1) * 100, sinal=True)}"

    return barras_agrupadas(
        grupos,
        [
            ("2025", VERDE_ANTERIOR, [a or 0 for a, _ in valores]),
            ("2026", VERDE_ATUAL, [d or 0 for _, d in valores]),
        ],
        [
            [(valor_curto(a), "") if a is not None else SEM_DOTACAO for a, _ in valores],
            [rotulo_2026(a, d) for a, d in valores],
        ],
        altura=_altura_funcoes(len(grupos)),
        espessura_pol=ESPESSURA_FUNCAO,
    )


def _planejado(somas: dict, ano: int, grupo) -> float | None:
    """Planejado do grupo no exercício, ou None se o grupo não existe nele."""
    g = somas.get((ano, grupo))
    return None if g is None else g["plan"]


def grafico_planejado_funcao(dados):
    """(c.1) Valor planejado OSG por função orçamentária, 2025 × 2026."""
    f = dados["funcao"]
    codigos = sorted({c for (a, c) in f if a in (2025, 2026)})
    return comparar_planejado_opcional(
        [(_planejado(f, 2025, c), _planejado(f, 2026, c)) for c in codigos],
        _grupos_funcao(dados, codigos),
    )


def ordem_orgaos(dados) -> list[str]:
    """
    Órgãos com valor em 2025 ou 2026, do maior planejado de 2026 para o menor —
    código de órgão não é ordem que o leitor reconheça, e o painel também ordena
    por valor. Os que não têm 2026 vão ao fim, pelo planejado de 2025.
    """
    o = dados["orgao"]
    codigos = {c for (a, c) in o if a in (2025, 2026)}
    return sorted(codigos, key=lambda c: (-(_planejado(o, 2026, c) or 0), -(_planejado(o, 2025, c) or 0)))


def grafico_planejado_orgao(dados):
    """(d.1) Valor planejado OSG por órgão executor, 2025 × 2026."""
    o = dados["orgao"]
    codigos = ordem_orgaos(dados)
    return comparar_planejado_opcional(
        [(_planejado(o, 2025, c), _planejado(o, 2026, c)) for c in codigos],
        # A sigla, como no gráfico de órgãos do painel: o nome do QDD não cabe
        # no eixo, e a unidade não identifica — 14 delas se chamam "Unidade
        # Gestora". O nome completo e o detalhe por unidade estão na Tabela 4.
        [(sigla_curta(dados["nomes_orgao"][c]), None) for c in codigos],
    )


def grafico_execucao_funcao(dados):
    """(c.2) Liquidado OSG por função orçamentária, 2024 × 2025, com a taxa de execução."""
    _exigir_liquidado(dados["funcao"], (2024, 2025), "Execução por função")
    f = dados["funcao"]
    codigos = sorted({c for (a, c) in f if a in (2024, 2025)})
    series, rotulos = [], []
    for ano, cor in ((2024, LILAS_ANTERIOR), (2025, LILAS_ATUAL)):
        do_ano = [f.get((ano, c)) for c in codigos]
        series.append((str(ano), cor, [x["liq"] if x else 0 for x in do_ano]))
        # Sem teto em 100%: Administração 2024 liquidou 28 vezes o planejado
        # (R$ 364 mil sobre R$ 13 mil), e o gráfico mostra o dado como ele é.
        rotulos.append(
            [
                (valor_curto(x["liq"]), f"· {pct(x['liq'] / x['plan'] * 100)} do planejado") if x else SEM_DOTACAO
                for x in do_ano
            ]
        )
    return barras_agrupadas(
        _grupos_funcao(dados, codigos),
        series,
        rotulos,
        altura=_altura_funcoes(len(codigos)),
        espessura_pol=ESPESSURA_FUNCAO,
    )


def comparar_plan_liq(
    pares: list[tuple[float, float]],
    grupos,
    altura: float | None = None,
    espessura_pol: float = ESPESSURA_FUNCAO,
    fmt=valor_curto,
):
    """
    Planejado × liquidado do mesmo exercício (2025), com a execução em cinza na
    barra do liquidado — c3 (funções), d2 (órgãos), a4 (categorias), b6 (eixos).
    `pares`: (planejado, liquidado) na ordem de `grupos`.

    O padrão é o das funções e órgãos: muitos grupos, barra fina, altura pelo
    número de grupos, valores pequenos em milhares. Categorias e eixos passam o
    visual da própria família — barra de 0,24 pol., altura fixa e `mi()`, para
    o liquidado de Governança sair "R$ 0,8 mi" como no b1, e não "R$ 796 mil".
    """
    return barras_agrupadas(
        grupos,
        [
            ("Planejado 2025", COR_PLANEJADO, [p for p, _ in pares]),
            ("Liquidado 2025", COR_LIQUIDADO, [l for _, l in pares]),
        ],
        [
            [(fmt(p), "") for p, _ in pares],
            [(fmt(l), f"· {pct(l / p * 100)}" if p else "") for p, l in pares],
        ],
        altura=_altura_funcoes(len(grupos)) if altura is None else altura,
        espessura_pol=espessura_pol,
    )


def _por_liquidado(somas: dict, ano: int, chaves) -> list:
    """Do maior liquidado para o menor — a medida das figuras de execução."""
    return sorted(chaves, key=lambda k: -somas[(ano, k)]["liq"])


def grafico_execucao_funcao_2025(dados):
    """(c.3) Planejado × liquidado OSG por função orçamentária em 2025, com a taxa de execução."""
    f = dados["funcao"]
    _exigir_liquidado(f, (2025,), "Execução por função em 2025")
    codigos = sorted(c for (a, c) in f if a == 2025)
    return comparar_plan_liq(
        [(f[(2025, c)]["plan"], f[(2025, c)]["liq"]) for c in codigos],
        _grupos_funcao(dados, codigos),
    )


def grafico_execucao_orgao_2025(dados):
    """(d.2) Planejado × liquidado OSG por órgão executor em 2025, com a taxa de execução."""
    o = dados["orgao"]
    _exigir_liquidado(o, (2025,), "Execução por órgão em 2025")
    # Do maior liquidado para o menor: é a medida desta figura, e órgão não tem
    # ordem natural que o leitor reconheça.
    codigos = _por_liquidado(o, 2025, [c for (a, c) in o if a == 2025])
    return comparar_plan_liq(
        [(o[(2025, c)]["plan"], o[(2025, c)]["liq"]) for c in codigos],
        [(sigla_curta(dados["nomes_orgao"][c]), None) for c in codigos],
    )


def grafico_execucao_categoria_2025(dados):
    """(a.4) Planejado × liquidado OSG por categoria em 2025, com a taxa de execução."""
    c = dados["cat"]
    exigir(c, CATEGORIAS, (2025,), "liq", "Execução por categoria em 2025", nome_categoria)
    return comparar_plan_liq(
        [(c[(2025, k)]["plan"], c[(2025, k)]["liq"]) for k in CATEGORIAS],
        GRUPOS_CATEGORIA,
        altura=3.6,
        espessura_pol=0.24,
        fmt=mi,
    )


def grafico_execucao_eixo_2025(dados):
    """(b.6) Planejado × liquidado OSG por eixo temático em 2025, com a taxa de execução."""
    e = dados["eixo"]
    exigir(e, ROMANOS, (2025,), "liq", "Execução por eixo em 2025", nome_eixo)
    return comparar_plan_liq(
        [(e[(2025, r)]["plan"], e[(2025, r)]["liq"]) for r in ROMANOS],
        GRUPOS_EIXO,
        altura=ALTURA_EIXOS,
        espessura_pol=0.24,
        fmt=mi,
    )


ANOS_TOTAL = (2024, 2025, 2026)


def _exigir_total(totais: dict, anos: tuple[int, ...], grafico: str, medida: str = "plan") -> None:
    """Mesmo rigor de `exigir`, um nível acima: aqui o grupo é o exercício inteiro."""
    for ano in anos:
        t = totais.get(ano)
        if t is None:
            sys.exit(
                f"{grafico}: o exercício {ano} não está nas exportações lidas. "
                f"A figura compara {', '.join(str(a) for a in anos)} e não pode sair pela metade."
            )
        if t[medida] is None:
            sys.exit(
                f"{grafico}: o liquidado de {ano} está vazio na exportação — o exercício "
                "ainda está em apuração no painel."
            )


def grafico_planejado_total(dados):
    """(e.1) Valor planejado total do OSG em 2024, 2025 e 2026, com as variações do período."""
    t = dados["total"]
    _exigir_total(t, ANOS_TOTAL, "Planejado total entre exercícios")
    base, meio, atual = (t[a]["plan"] for a in ANOS_TOTAL)

    # Uma série só, e por isso uma cor só: o exercício está escrito no rótulo do
    # grupo, então a rampa clara→escura das outras figuras não teria o que
    # acrescentar aqui — e um terceiro passo de verde exigiria medir contraste e
    # separação de novo, que o comentário das cores documenta ter sido feito só
    # para os pares.
    #
    # As duas comparações do item (e) vão no complemento cinza da barra de 2026,
    # junto do valor que o olho já está lendo. 2024 não leva variação: é o
    # primeiro ano de apuração do OSG e não tem sobre o que variar.
    complementos = [
        "· primeiro ano de apuração",
        f"· {pct((meio / base - 1) * 100, sinal=True)} sobre 2024",
        f"· {pct((atual / meio - 1) * 100, sinal=True)} sobre 2025"
        f" · {pct((atual / base - 1) * 100, sinal=True)} sobre 2024",
    ]
    valores = [base, meio, atual]
    return barras_agrupadas(
        [(str(a), None) for a in ANOS_TOTAL],
        [("Valor planejado OSG", VERDE_ATUAL, valores)],
        [[(mi(v), c) for v, c in zip(valores, complementos)]],
        # Três barras numa série só: altura por barra próxima à das figuras de
        # categoria, para a família inteira ter o mesmo peso na página.
        altura=1.9,
        com_legenda=False,
    )


def grafico_execucao_total_2025(dados):
    """(e.2) Planejado × liquidado total do OSG em 2025, com a taxa de execução."""
    t = dados["total"]
    _exigir_total(t, (2025,), "Execução total em 2025", "liq")
    # Mesmo molde de a4, b6, c3 e d2 — só que o grupo é o exercício inteiro.
    return comparar_plan_liq(
        [(t[2025]["plan"], t[2025]["liq"])],
        [("Total do OSG", None)],
        # Um grupo só: a altura é a da legenda mais as duas barras, sem o
        # respiro que várias faixas pediriam.
        altura=1.5,
        espessura_pol=0.24,
        fmt=mi,
    )


GRAFICOS = [
    ("a1-planejado-categoria-2025-2026.png", grafico_planejado_categoria),
    ("a2-execucao-categoria-2024-2025.png", grafico_execucao_categoria),
    ("a3-dotacoes-categoria-2025-2026.png", grafico_dotacoes_categoria),
    ("a4-execucao-categoria-2025.png", grafico_execucao_categoria_2025),
    ("b1-execucao-eixo-2024-2025.png", grafico_execucao_eixo),
    ("b2-planejado-eixo-2025-2026.png", grafico_planejado_eixo),
    ("b3-dotacoes-eixo-2025-2026.png", grafico_dotacoes_eixo),
    ("b4-distribuicao-liquidado-eixo-2025-barras.png", grafico_distribuicao_eixo_barras),
    ("b5-distribuicao-liquidado-eixo-2025-rosca.png", grafico_distribuicao_eixo_rosca),
    ("b6-execucao-eixo-2025.png", grafico_execucao_eixo_2025),
    ("c1-planejado-funcao-2025-2026.png", grafico_planejado_funcao),
    ("c2-execucao-funcao-2024-2025.png", grafico_execucao_funcao),
    ("c3-execucao-funcao-2025.png", grafico_execucao_funcao_2025),
    ("d1-planejado-orgao-2025-2026.png", grafico_planejado_orgao),
    ("d2-execucao-orgao-2025.png", grafico_execucao_orgao_2025),
    ("e1-planejado-total-2024-2025-2026.png", grafico_planejado_total),
    ("e2-execucao-total-2025.png", grafico_execucao_total_2025),
]


# --------------------------------------------------------------------------- #
# Tabelas por função orçamentária (Word)
# --------------------------------------------------------------------------- #

TRACO = "—"  # célula sem valor: a função não teve dotação no exercício


def _filete(celula, lado: str, oitavos_de_ponto: int) -> None:
    """
    Filete horizontal na célula. Chamar "top" antes de "bottom" na mesma célula:
    o esquema do Word fixa a ordem dos filhos de `w:tcBorders`.
    """
    tc_pr = celula._tc.get_or_add_tcPr()
    bordas = tc_pr.find(qn("w:tcBorders"))
    if bordas is None:
        bordas = OxmlElement("w:tcBorders")
        tc_pr.append(bordas)
    el = OxmlElement(f"w:{lado}")
    for atributo, valor in (("val", "single"), ("sz", str(oitavos_de_ponto)), ("space", "0"), ("color", "4F545B")):
        el.set(qn(f"w:{atributo}"), valor)
    bordas.append(el)


def _paragrafo(doc, texto: str, tamanho: float, negrito: bool = False, depois: float = 2, junto: bool = False):
    p = doc.add_paragraph()
    run = p.add_run(texto)
    run.font.size = Pt(tamanho)
    run.bold = negrito
    if tamanho < 9:
        run.font.color.rgb = RGBColor(0x4F, 0x54, 0x5B)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(depois)
    # O título não fica sozinho no pé da página, longe da tabela.
    p.paragraph_format.keep_with_next = junto
    return p


def _documento_a4():
    doc = Document()
    secao = doc.sections[0]
    # O modelo do python-docx é Carta; o relatório é A4.
    secao.page_width, secao.page_height = Cm(21), Cm(29.7)
    for margem in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(secao, margem, Cm(2.5))
    return doc


def _tabela(
    doc, titulo, cabecalho, linhas, total, larguras_cm, rodape, negrito=(), recuo=(), italico=()
) -> None:
    """
    Tabela no estilo de relatório: filete grosso acima do cabeçalho e abaixo do
    total, fino sob o cabeçalho e acima do total, sem linhas verticais. Números
    à direita; a primeira coluna, o nome, à esquerda.

    `negrito` e `italico`: índices de `linhas` em negrito ou itálico (subtotais).
    `recuo`: índices com a primeira célula recuada — um conjunto recua um nível
    (Tabelas 4 e 5, unidades sob o órgão); um dicionário {índice: nível} recua
    0,35 cm por nível (Tabela 6: unidade no 1, aplicação programada no 2).
    """
    niveis = recuo if isinstance(recuo, dict) else {k: 1 for k in recuo}
    _paragrafo(doc, titulo, 10, negrito=True, depois=4, junto=True)
    tabela = doc.add_table(rows=len(linhas) + 2, cols=len(cabecalho))
    tabela.alignment = WD_TABLE_ALIGNMENT.CENTER
    tabela.autofit = False
    todas = [cabecalho, *linhas, total]
    ultima = len(todas) - 1
    for j, largura in enumerate(larguras_cm):
        tabela.columns[j].width = Cm(largura)
    for i, linha in enumerate(todas):
        for j, texto in enumerate(linha):
            celula = tabela.cell(i, j)
            celula.width = Cm(larguras_cm[j])
            par = celula.paragraphs[0]
            par.alignment = WD_ALIGN_PARAGRAPH.LEFT if j == 0 else WD_ALIGN_PARAGRAPH.RIGHT
            par.paragraph_format.space_before = Pt(2)
            par.paragraph_format.space_after = Pt(2)
            if j == 0 and i - 1 in niveis:
                par.paragraph_format.left_indent = Cm(0.35 * niveis[i - 1])
            run = par.add_run(texto)
            run.font.size = Pt(9)
            run.bold = i in (0, ultima) or i - 1 in negrito
            # Só onde é itálico: gravar `italic = False` nas demais mudaria o XML
            # das Tabelas 1 a 5 sem mudar nada na tela.
            if i - 1 in italico:
                run.italic = True
            if i == 0:
                _filete(celula, "top", 8)
                _filete(celula, "bottom", 4)
            elif i == ultima:
                _filete(celula, "top", 4)
                _filete(celula, "bottom", 8)
    # O cabeçalho se repete se a tabela quebrar de página.
    tr_pr = tabela.rows[0]._tr.get_or_add_trPr()
    repetir = OxmlElement("w:tblHeader")
    repetir.set(qn("w:val"), "true")
    tr_pr.append(repetir)
    for texto in rodape:
        _paragrafo(doc, texto, 8, depois=0)
    _paragrafo(doc, "", 9, depois=10)


def tabelas_funcoes(funcoes: dict[tuple, dict], entregas: list[dict], datas: list[str]) -> str:
    """
    As três tabelas por função orçamentária, num .docx para copiar no relatório.

    Tabelas, e não gráficos: são 15 ou 16 funções por comparação, várias perto
    de zero, e em barras elas virariam traços ilegíveis numa página inteira. Os
    valores vão com centavos, como no painel e no XLSX — o relatório pode citar
    e conferir qualquer célula.
    """
    nomes = {cod: f["nome"] for (_, cod), f in sorted(funcoes.items())}
    rotulo = lambda cod: f"{cod} {nomes[cod]}"  # noqa: E731
    fonte = f"Fonte: Painel do Orçamento Sensível ao Gênero — DEPPO/SEPLAN, exportações de {' e '.join(datas)}."
    nota_traco = f"“{TRACO}”: função sem dotação no exercício."
    nota_exec = (
        "Execução = liquidado ÷ planejado da função no exercício; acima de 100% indica liquidado superior ao "
        "planejado."
    )

    def exigir_liquidado(ano: int) -> None:
        if any(f["liq"] is None for (a, _), f in funcoes.items() if a == ano):
            sys.exit(f"Tabelas por função: o liquidado de {ano} está vazio — o exercício ainda está em apuração.")

    def execucao(f) -> str:
        return pct(f["liq"] / f["plan"] * 100) if f and f["plan"] else TRACO

    doc = _documento_a4()

    # Tabela 1 — planejado 2025 × 2026.
    codigos = sorted({c for (a, c) in funcoes if a in (2025, 2026)})
    linhas = []
    for c in codigos:
        a, d = funcoes.get((2025, c)), funcoes.get((2026, c))
        if a and d:
            var = pct((d["plan"] / a["plan"] - 1) * 100, sinal=True) if a["plan"] else TRACO
        else:
            var = "nova em 2026" if d else "sem planejado em 2026"
        linhas.append([rotulo(c), reais(a["plan"]) if a else TRACO, reais(d["plan"]) if d else TRACO, var])
    p25, p26 = totais_do_ano(entregas, 2025)[0], totais_do_ano(entregas, 2026)[0]
    _tabela(
        doc,
        "Tabela 1 – Valor planejado OSG por função orçamentária, 2025 e 2026",
        ["Função", "2025 (R$)", "2026 (R$)", "Variação"],
        linhas,
        ["Total", reais(p25), reais(p26), pct((p26 / p25 - 1) * 100, sinal=True)],
        # Larguras medidas em Calibri 9 pt (o corpo do modelo) contra o maior
        # texto de cada coluna: "sem planejado em 2026" pede 3,5 cm.
        [5.4, 3.4, 3.4, 3.8],
        [nota_traco, fonte],
    )

    # Tabela 2 — execução 2024 × 2025.
    exigir_liquidado(2024)
    exigir_liquidado(2025)
    codigos = sorted({c for (a, c) in funcoes if a in (2024, 2025)})
    linhas = []
    for c in codigos:
        a, d = funcoes.get((2024, c)), funcoes.get((2025, c))
        linhas.append(
            [rotulo(c), reais(a["liq"]) if a else TRACO, execucao(a), reais(d["liq"]) if d else TRACO, execucao(d)]
        )
    (p24, l24), (p25, l25) = totais_do_ano(entregas, 2024), totais_do_ano(entregas, 2025)
    _tabela(
        doc,
        "Tabela 2 – Liquidado OSG e execução por função orçamentária, 2024 e 2025",
        ["Função", "Liquidado 2024 (R$)", "Execução 2024", "Liquidado 2025 (R$)", "Execução 2025"],
        linhas,
        ["Total", reais(l24), pct(l24 / p24 * 100), reais(l25), pct(l25 / p25 * 100)],
        [4.4, 3.2, 2.6, 3.2, 2.6],
        [nota_exec, nota_traco, fonte],
    )

    # Tabela 3 — execução 2025.
    codigos = sorted(c for (a, c) in funcoes if a == 2025)
    linhas = [
        [rotulo(c), reais(funcoes[(2025, c)]["plan"]), reais(funcoes[(2025, c)]["liq"]), execucao(funcoes[(2025, c)])]
        for c in codigos
    ]
    _tabela(
        doc,
        "Tabela 3 – Planejado, liquidado e execução OSG por função orçamentária, 2025",
        ["Função", "Planejado (R$)", "Liquidado (R$)", "Execução"],
        linhas,
        ["Total", reais(p25), reais(l25), pct(l25 / p25 * 100)],
        [6.4, 3.4, 3.4, 2.8],
        [nota_exec, fonte],
    )

    caminho = os.path.join(SAIDA, "c-tabelas-funcoes.docx")
    doc.save(caminho)
    return caminho


def tabela_orgaos_unidades(dados: dict, entregas: list[dict], datas: list[str]) -> str:
    """
    Tabela 4: planejado 2025 × 2026 por órgão executor, com as unidades de cada
    órgão logo abaixo dele.

    O órgão vai em negrito, como subtotal, e as unidades recuadas: são 30
    unidades e 14 delas se chamam "Unidade Gestora" — soltas numa lista, não
    daria para saber de quem é cada uma. Órgãos na ordem do gráfico d1 (maior
    planejado de 2026 primeiro); dentro do órgão, a mesma regra.
    """
    o, u = dados["orgao"], dados["unidade"]

    def variacao(a, b) -> str:
        if a is not None and b is not None:
            return pct((b / a - 1) * 100, sinal=True) if a else TRACO
        return "nova em 2026" if b is not None else "sem planejado em 2026"

    def valor(v) -> str:
        return TRACO if v is None else reais(v)

    linhas, negrito, recuo = [], set(), set()
    for org in ordem_orgaos(dados):
        a, b = _planejado(o, 2025, org), _planejado(o, 2026, org)
        negrito.add(len(linhas))
        linhas.append([f"{org} {dados['nomes_orgao'][org]}", valor(a), valor(b), variacao(a, b)])
        unidades = sorted(
            {k for (ano, k) in u if ano in (2025, 2026) and k.split("/")[0] == org},
            key=lambda k: (-(_planejado(u, 2026, k) or 0), -(_planejado(u, 2025, k) or 0)),
        )
        for k in unidades:
            a, b = _planejado(u, 2025, k), _planejado(u, 2026, k)
            recuo.add(len(linhas))
            linhas.append([f"{k.split('/')[1]} {dados['nomes_unidade'][k]}", valor(a), valor(b), variacao(a, b)])

    p25, p26 = totais_do_ano(entregas, 2025)[0], totais_do_ano(entregas, 2026)[0]
    doc = _documento_a4()
    _tabela(
        doc,
        "Tabela 4 – Valor planejado OSG por órgão e unidade executora, 2025 e 2026",
        ["Órgão / unidade", "2025 (R$)", "2026 (R$)", "Variação"],
        linhas,
        ["Total", reais(p25), reais(p26), pct((p26 / p25 - 1) * 100, sinal=True)],
        # Medidas em Calibri 9 pt: "sem planejado em 2026" em NEGRITO (linha de
        # órgão, caso da CGE) pede 3,6 cm — 3,5 quebrava por um fio. A primeira
        # coluna pode quebrar (nomes longos do QDD); as de números, não.
        [6.2, 3.1, 3.1, 3.6],
        [
            "Em negrito, o órgão executor (soma das suas unidades); abaixo, recuadas, as unidades orçamentárias.",
            f"“{TRACO}”: sem dotação no exercício.",
            f"Fonte: Painel do Orçamento Sensível ao Gênero — DEPPO/SEPLAN, exportações de {' e '.join(datas)}.",
        ],
        negrito=negrito,
        recuo=recuo,
    )

    # Tabela 5 — planejado × liquidado × execução em 2025, na mesma estrutura:
    # órgão em negrito, unidades recuadas, do maior liquidado para o menor.
    _exigir_liquidado(o, (2025,), "Tabela 5")
    _exigir_liquidado(u, (2025,), "Tabela 5")

    def execucao(g) -> str:
        return pct(g["liq"] / g["plan"] * 100) if g["plan"] else TRACO

    linhas, negrito, recuo = [], set(), set()
    for org in _por_liquidado(o, 2025, [c for (a, c) in o if a == 2025]):
        g = o[(2025, org)]
        negrito.add(len(linhas))
        linhas.append([f"{org} {dados['nomes_orgao'][org]}", reais(g["plan"]), reais(g["liq"]), execucao(g)])
        for k in _por_liquidado(u, 2025, [k for (a, k) in u if a == 2025 and k.split("/")[0] == org]):
            g = u[(2025, k)]
            recuo.add(len(linhas))
            linhas.append([f"{k.split('/')[1]} {dados['nomes_unidade'][k]}", reais(g["plan"]), reais(g["liq"]), execucao(g)])
    p25, l25 = totais_do_ano(entregas, 2025)
    _tabela(
        doc,
        "Tabela 5 – Planejado, liquidado e execução OSG por órgão e unidade executora, 2025",
        ["Órgão / unidade", "Planejado (R$)", "Liquidado (R$)", "Execução"],
        linhas,
        ["Total", reais(p25), reais(l25), pct(l25 / p25 * 100)],
        [6.4, 3.4, 3.4, 2.8],
        [
            "Em negrito, o órgão executor (soma das suas unidades); abaixo, recuadas, as unidades orçamentárias.",
            "Execução = liquidado ÷ planejado no exercício; acima de 100% indica liquidado superior ao planejado. "
            "Em unidades de planejado muito pequeno, a taxa pode ficar muito alta.",
            f"Fonte: Painel do Orçamento Sensível ao Gênero — DEPPO/SEPLAN, exportações de {' e '.join(datas)}.",
        ],
        negrito=negrito,
        recuo=recuo,
    )
    caminho = os.path.join(SAIDA, "d-tabela-orgaos-unidades.docx")
    doc.save(caminho)
    return caminho


def tabela_execucao_2025(dados: dict, entregas: list[dict], datas: list[str]) -> str:
    """
    Tabela 6: a execução de 2025 no nível mais fino — órgão, unidade e cada
    aplicação programada (a dotação), com o código do projeto/atividade.

    Três níveis, do maior liquidado para o menor em cada um, como na Tabela 5:
    órgão em negrito, unidade em itálico e recuada, dotação mais recuada. O
    código fica numa coluna própria porque há textos repetidos na mesma unidade
    (emendas da SEMULHER com a mesma redação), e é ele que distingue a linha.
    """
    o, u, d = dados["orgao"], dados["unidade"], dados["dot"]
    for somas in (o, u, d):
        _exigir_liquidado(somas, (2025,), "Tabela 6")
    conflitos = sorted(k for k in dados["aplicacao_conflito"] if k[0] == 2025)
    if conflitos:
        sys.exit(f"Tabela 6: a dotação {'/'.join(conflitos[0][1])} tem entregas com aplicações programadas diferentes.")

    def execucao(g) -> str:
        return pct(g["liq"] / g["plan"] * 100) if g["plan"] else TRACO

    dotacoes = [k for (a, k) in d if a == 2025]
    linhas, negrito, italico, recuo = [], set(), set(), {}
    for org in _por_liquidado(o, 2025, [c for (a, c) in o if a == 2025]):
        g = o[(2025, org)]
        negrito.add(len(linhas))
        linhas.append([f"{org} {dados['nomes_orgao'][org]}", "", reais(g["plan"]), reais(g["liq"]), execucao(g)])
        for uk in _por_liquidado(u, 2025, [k for (a, k) in u if a == 2025 and k.split("/")[0] == org]):
            g = u[(2025, uk)]
            italico.add(len(linhas))
            recuo[len(linhas)] = 1
            linhas.append([f"{uk.split('/')[1]} {dados['nomes_unidade'][uk]}", "", reais(g["plan"]), reais(g["liq"]), execucao(g)])
            da_unidade = [k for k in dotacoes if f"{k[0]}/{k[1]}" == uk]
            # Empate de liquidado (há dotações zeradas) desfeito pelo código.
            for k in sorted(da_unidade, key=lambda k: (-d[(2025, k)]["liq"], k[2])):
                g = d[(2025, k)]
                recuo[len(linhas)] = 2
                linhas.append(
                    [dados["aplicacao"][(2025, k)].upper(), k[2], reais(g["plan"]), reais(g["liq"]), execucao(g)]
                )
    p25, l25 = totais_do_ano(entregas, 2025)
    doc = _documento_a4()
    _tabela(
        doc,
        "Tabela 6 – Detalhamento da execução OSG de 2025 por órgão, unidade e aplicação programada",
        ["Órgão / unidade / aplicação programada", "Proj./ativ.", "Planejado (R$)", "Liquidado (R$)", "Execução"],
        linhas,
        ["Total", "", reais(p25), reais(l25), pct(l25 / p25 * 100)],
        # A4 retrato, 16 cm. Código e números não quebram (medidos em Calibri
        # 9 pt, negrito medido em negrito); o texto da primeira coluna quebra.
        # Com 1,7 cm o cabeçalho "Proj./ativ." em negrito passava por 0,01 cm e
        # os códigos sobravam por 0,02 — 1,9 dá folga real.
        [6.5, 1.9, 2.8, 2.8, 2.0],
        [
            "Em negrito, o órgão executor; em itálico e recuada, a unidade orçamentária; mais recuada, cada "
            "aplicação programada (dotação), com o código do projeto/atividade.",
            "Execução = liquidado ÷ planejado no exercício; acima de 100% indica liquidado superior ao planejado. "
            "Em dotações de planejado muito pequeno, a taxa pode ficar muito alta.",
            "Aplicação programada padronizada em maiúsculas: o texto de origem mistura as duas formas.",
            # Subtotal exato, linhas arredondadas: é o painel que mostra cada
            # dotação e cada unidade assim, e as duas coisas batem com ele.
            "Os subtotais são somas exatas; a soma das linhas exibidas pode diferir em centavos, por arredondamento.",
            f"Fonte: Painel do Orçamento Sensível ao Gênero — DEPPO/SEPLAN, exportações de {' e '.join(datas)}.",
        ],
        negrito=negrito,
        recuo=recuo,
        italico=italico,
    )
    caminho = os.path.join(SAIDA, "e-tabela-execucao-2025.docx")
    doc.save(caminho)
    return caminho


# --------------------------------------------------------------------------- #
# Notas explicativas (Word)
# --------------------------------------------------------------------------- #

NOME_CATEGORIA = {
    1: "Categoria 1 (dotações exclusivas)",
    2: "Categoria 2 (entrega estratégica)",
    3: "Categoria 3 (público misto)",
}


def _secao(doc, texto: str) -> None:
    _paragrafo(doc, texto, 13, negrito=True, depois=6, junto=True)


def _subtitulo(doc, texto: str) -> None:
    _paragrafo(doc, texto, 11, negrito=True, depois=3, junto=True)


def _campo(doc, rotulo: str, texto: str) -> None:
    """Parágrafo com o rótulo em negrito na frente ("O que mostra. …")."""
    p = doc.add_paragraph()
    for parte, negrito in ((f"{rotulo} ", True), (texto, False)):
        run = p.add_run(parte)
        run.bold = negrito
        run.font.size = Pt(10)
    p.paragraph_format.space_after = Pt(3)


def _itens(doc, itens: list[str]) -> None:
    for texto in itens:
        p = doc.add_paragraph(style="List Bullet")
        p.add_run(texto).font.size = Pt(10)
        p.paragraph_format.space_after = Pt(1)


def _lista(nomes: list[str]) -> str:
    """"a, b e c" — ou "nenhuma" para lista vazia."""
    if not nomes:
        return "nenhuma"
    return nomes[0] if len(nomes) == 1 else f"{', '.join(nomes[:-1])} e {nomes[-1]}"


def _var(a: float, b: float) -> str:
    return pct((b / a - 1) * 100, sinal=True)


def _destaques_comparacao(
    valores: dict, nome, fmt, ano_a: int, ano_b: int, em_reais: bool = False
) -> list[str]:
    """
    Maior alta, maior queda e maior valor do exercício mais recente, entre os
    grupos que existem nos dois anos. `valores`: {grupo: (valor_a, valor_b)}.

    `em_reais`: ordena pela diferença em reais, e não pela variação percentual.
    Para as unidades, onde há base de R$ 500 — o percentual elegia como "maior
    alta" um salto de +217.734%, que diz mais sobre a base do que sobre a unidade.
    """
    ambos = {k: v for k, v in valores.items() if v[0] and v[1]}
    itens = []
    criterio = (lambda k: ambos[k][1] - ambos[k][0]) if em_reais else (lambda k: ambos[k][1] / ambos[k][0])
    alta, queda = max(ambos, key=criterio), min(ambos, key=criterio)
    rotulo_alta, rotulo_queda = ("Maior aumento em reais", "Maior redução em reais") if em_reais else ("Maior alta", "Maior queda")
    a, b = ambos[alta]
    itens.append(f"{rotulo_alta}: {nome(alta)}, de {fmt(a)} para {fmt(b)} ({_var(a, b)}).")
    a, b = ambos[queda]
    if b < a:
        itens.append(f"{rotulo_queda}: {nome(queda)}, de {fmt(a)} para {fmt(b)} ({_var(a, b)}).")
    total_b = sum(v[1] or 0 for v in valores.values())
    topo = max(valores, key=lambda k: valores[k][1] or 0)
    itens.append(
        f"Maior valor em {ano_b}: {nome(topo)}, com {fmt(valores[topo][1])} "
        f"({pct(valores[topo][1] / total_b * 100)} do total do exercício)."
    )
    return itens


def _acima_de_100(grupos: dict, nome) -> list[str]:
    """Grupos com liquidado maior que o planejado, com a taxa: ["Trabalho (225,6%)", …]."""
    return [
        f"{nome(k)} ({pct(g['liq'] / g['plan'] * 100)})"
        for k, g in grupos.items()
        if g and g["plan"] and g["liq"] is not None and g["liq"] > g["plan"]
    ]


def notas_explicativas(dados: dict, entregas: list[dict], datas: list[str]) -> str:
    """
    O documento que acompanha os gráficos e tabelas: fonte, conceitos e, para
    cada figura, o que ela mostra, como ler, destaques e ressalvas.

    Os destaques saem dos dados, não de texto fixo: reexportar o painel e rodar
    o script de novo atualiza as notas junto com as figuras, e as duas coisas
    não podem contar histórias diferentes.
    """
    cat, eixo, fun = dados["cat"], dados["eixo"], dados["funcao"]
    dcat, deixo = dados["dot_cat"], dados["dot_eixo"]
    nome_cat = NOME_CATEGORIA.get
    nome_eixo_ = {r: f"Eixo {r} – {n}" for r, n, _ in EIXOS}.get
    nome_fun = lambda c: f"{c} {dados['nomes_funcao'][c]}"  # noqa: E731
    tot = {a: totais_do_ano(entregas, a) for a in (2024, 2025, 2026)}
    # Só as unidades de 2025 e 2026, o recorte do item (d): com 2024 a conta
    # incluía uma Unidade Gestora que não está no gráfico nem na Tabela 4.
    unidades_gestoras = sum(
        1
        for k in {k for (a, k) in dados["unidade"] if a in (2025, 2026)}
        if dados["nomes_unidade"][k].upper() == "UNIDADE GESTORA"
    )
    ndot = {a: len({e["dot"] for e in entregas if e["ano"] == a}) for a in tot}
    execucao_total = lambda a: pct(tot[a][1] / tot[a][0] * 100)  # noqa: E731
    fonte = f"Painel do Orçamento Sensível ao Gênero — DEPPO/SEPLAN, exportações de {' e '.join(datas)}"

    doc = _documento_a4()

    _paragrafo(doc, "Notas explicativas — gráficos e tabelas do Relatório do OSG 2026", 16, negrito=True, depois=4)
    _paragrafo(
        doc,
        "Para cada figura: o arquivo, uma legenda sugerida para o Word, o que ela mostra, como ler, "
        "os destaques e as ressalvas. Os números vêm dos mesmos dados das figuras.",
        10,
        depois=12,
    )

    # --- Fonte e base de dados -------------------------------------------- #
    _secao(doc, "1. Fonte e base de dados")
    _paragrafo(
        doc,
        "Todas as figuras e tabelas foram geradas pelo script relatorio/graficos.py a partir das exportações "
        "em XLSX do Painel do Orçamento Sensível ao Gênero (DEPPO/SEPLAN), uma por exercício (2024, 2025 e "
        f"2026), feitas em {' e '.join(datas)}. Os números por trás de cada "
        "barra e de cada célula estão em dados-graficos.csv. Valores em reais correntes, sem correção pela "
        "inflação.",
        10,
        depois=4,
    )
    _itens(
        doc,
        [
            f"{a}: planejado R$ {reais(tot[a][0])}; "
            + ("liquidado em apuração" if tot[a][1] is None else f"liquidado R$ {reais(tot[a][1])} (execução {execucao_total(a)})")
            + f"; {ndot[a]} dotações."
            for a in (2024, 2025, 2026)
        ],
    )
    # Texto de `NOTA_EM_APURACAO` (src/lib/conteudo.ts), o mesmo do painel.
    _campo(
        doc,
        "Execução de 2026 em apuração.",
        "O valor planejado de 2026 vem da lei orçamentária e está fechado. O liquidado, não: é um acumulado "
        "parcial do ano em curso e ainda vai subir até o encerramento. Por isso ele não aparece nas figuras "
        "de execução, que param em 2025 — compará-lo com exercícios encerrados faria o ano corrente parecer "
        "pior do que vai terminar.",
    )
    _campo(
        doc,
        "Correção de 11/09/2026.",
        "O relatório de origem de 2026 foi substituído para reclassificar uma entrega da SEMULHER "
        "(R$ 3.557.000,00), que estava em Assistência Social e é do eixo Governança. Números por eixo de "
        "2026 anteriores a essa data estão superados.",
    )

    # --- Conceitos -------------------------------------------------------- #
    _secao(doc, "2. Conceitos")
    _itens(
        doc,
        [
            "Valor planejado OSG: a parcela da dotação apropriada ao OSG, segundo a regra da categoria — não "
            "o orçamento inteiro da dotação.",
            "Liquidado OSG: o valor liquidado apropriado ao OSG no exercício.",
            "Execução: liquidado ÷ planejado do mesmo grupo e exercício. Acima de 100% indica liquidado "
            "superior ao planejado.",
            "Dotação: a combinação de exercício, órgão/unidade orçamentária e projeto/atividade, a mesma "
            "unidade do painel. Uma dotação reúne uma ou mais entregas.",
            "Categorias: 1 – dotações exclusivas (apropria 100% do valor aprovado na LOA); 2 – dotações com "
            "entrega estratégica (o órgão executor discrimina o valor apropriado); 3 – dotações de público "
            "misto (apropria 50% do valor aprovado na LOA).",
            "Eixos: os seis do art. 4º da Lei nº 4.168/2023 — "
            + _lista([f"{r} {n}" for r, n, _ in EIXOS])
            + ".",
            "Função orçamentária: a classificação funcional da despesa atribuída à dotação (por exemplo, "
            "10 Saúde, 15 Urbanismo).",
            "Órgão e unidade executora: o órgão soma todas as suas unidades orçamentárias; a unidade é a "
            "unidade orçamentária dentro do órgão (fundo, fundação, instituto ou a própria Unidade Gestora). "
            f"Como {unidades_gestoras} órgãos têm uma unidade chamada “Unidade Gestora”, o gráfico mostra "
            "órgãos e a tabela mostra cada unidade sob o seu órgão.",
        ],
    )
    _campo(
        doc,
        "Convenções dos gráficos.",
        "Verde é valor planejado e lilás é liquidado, como no painel; nos comparativos entre exercícios, o "
        "tom claro é o ano anterior e o escuro, o mais recente. O valor está escrito na ponta de cada barra, "
        "e a variação aparece em cinza na barra do exercício mais recente. Eixos seguem a ordem da lei, "
        "categorias a ordem 1-2-3 e funções a ordem do código — nunca a ordem do valor. Os gráficos saem sem "
        "título nem fonte: a legenda sugerida abaixo vai no Word.",
    )

    # --- Figuras e tabelas ------------------------------------------------ #
    _secao(doc, "3. Figuras e tabelas")

    def entrada(arquivo, legenda, mostra, leitura, destaques, ressalvas=()):
        _subtitulo(doc, arquivo)
        _campo(doc, "Legenda sugerida.", legenda)
        _campo(doc, "O que mostra.", mostra)
        _campo(doc, "Como ler.", leitura)
        _campo(doc, "Destaques.", "")
        _itens(doc, destaques)
        if ressalvas:
            _campo(doc, "Ressalvas.", "")
            _itens(doc, list(ressalvas))
        _paragrafo(doc, f"Fonte: {fonte}.", 8, depois=12)

    ler_comparacao = (
        "Duas barras por grupo, do exercício anterior (tom claro) e do mais recente (tom escuro). A variação "
        "entre os dois está em cinza, ao lado do valor da barra mais recente."
    )
    ler_execucao = (
        "Duas barras por grupo, uma por exercício. Cada uma traz o liquidado e, em cinza, a execução — quanto "
        "do planejado do próprio grupo foi liquidado."
    )
    ressalva_100 = "Execução acima de 100% indica liquidado superior ao planejado; o gráfico não corta em 100%."

    # a1
    v = {c: (cat[(2025, c)]["plan"], cat[(2026, c)]["plan"]) for c in CATEGORIAS}
    entrada(
        "a1-planejado-categoria-2025-2026.png",
        "Valor planejado OSG por categoria, 2025 e 2026",
        "O valor apropriado ao OSG em cada categoria, nos exercícios de 2025 e 2026.",
        ler_comparacao,
        [f"Total planejado: {mi(tot[2025][0])} em 2025 e {mi(tot[2026][0])} em 2026 ({_var(tot[2025][0], tot[2026][0])})."]
        + _destaques_comparacao(v, nome_cat, mi, 2025, 2026),
    )

    # a2
    acima = _acima_de_100({(a, c): cat[(a, c)] for a in (2024, 2025) for c in CATEGORIAS}, lambda k: f"{nome_cat(k[1])} em {k[0]}")
    entrada(
        "a2-execucao-categoria-2024-2025.png",
        "Liquidado OSG e execução por categoria, 2024 e 2025",
        "Quanto foi liquidado em cada categoria em 2024 e 2025, e a execução de cada uma.",
        ler_execucao,
        [
            f"Execução total: {execucao_total(2024)} em 2024 e {execucao_total(2025)} em 2025.",
            "Execução por categoria em 2025: "
            + _lista([f"{c} – {pct(cat[(2025, c)]['liq'] / cat[(2025, c)]['plan'] * 100)}" for c in CATEGORIAS])
            + ".",
            f"Liquidado acima do planejado: {_lista(acima)}.",
        ],
        [ressalva_100],
    )

    # a3
    v = {c: (dcat[(2025, c)]["n"], dcat[(2026, c)]["n"]) for c in CATEGORIAS}
    soma25 = sum(dcat[(2025, c)]["n"] for c in CATEGORIAS)
    entrada(
        "a3-dotacoes-categoria-2025-2026.png",
        "Número de dotações por categoria, 2025 e 2026",
        "Quantas dotações têm entregas em cada categoria, em 2025 e 2026.",
        "Duas barras por categoria, uma por exercício. Na barra de 2026, em cinza, a diferença em número de "
        "dotações e, entre parênteses, em percentual.",
        [f"Total de dotações: {ndot[2025]} em 2025 e {ndot[2026]} em 2026 (+{ndot[2026] - ndot[2025]})."]
        + [f"{nome_cat(c)}: {a} → {b} ({'+' if b >= a else '−'}{abs(b - a)})." for c, (a, b) in v.items()],
        [
            "Conta dotações, não entregas: a mesma regra do painel.",
            f"Uma dotação conta em cada categoria em que tem entrega. Em 2025, {soma25 - ndot[2025]} dotações têm "
            f"entregas nas categorias 2 e 3 e entram nas duas — por isso as categorias somam {soma25} contra "
            f"{ndot[2025]} dotações.",
            "Dotações com valor planejado zero em 2026 (emendas ainda sem alocação e uma ação financiada só por "
            "superávit) são contadas, como no painel.",
        ],
    )

    # a4
    ler_plan_liq = (
        "Duas barras por grupo: planejado (verde) e liquidado (lilás) de 2025, com a execução em cinza ao lado "
        "do liquidado."
    )

    def destaques_plan_liq(somas: dict, grupos, nome) -> list[str]:
        taxas = {k: somas[(2025, k)]["liq"] / somas[(2025, k)]["plan"] * 100 for k in grupos}
        alto, baixo = max(taxas, key=taxas.get), min(taxas, key=taxas.get)
        return [
            f"Execução total em 2025: {execucao_total(2025)}.",
            # "com x%", e não "(x%)": o nome da categoria já traz parênteses.
            f"Maior execução: {nome(alto)}, com {pct(taxas[alto])}; menor: {nome(baixo)}, com {pct(taxas[baixo])}.",
            f"Liquidado acima do planejado: {_lista(_acima_de_100({k: somas[(2025, k)] for k in grupos}, nome))}.",
        ]

    entrada(
        "a4-execucao-categoria-2025.png",
        "Planejado, liquidado e execução OSG por categoria, 2025",
        "Para cada categoria, o valor planejado e o liquidado de 2025 lado a lado, com a execução.",
        ler_plan_liq,
        destaques_plan_liq(cat, CATEGORIAS, nome_cat),
        ["O liquidado de 2025 é o mesmo do gráfico a2; aqui ele aparece ao lado do planejado de 2025, e não de 2024."],
    )

    # b1
    acima = _acima_de_100({(a, r): eixo[(a, r)] for a in (2024, 2025) for r in ROMANOS}, lambda k: f"{nome_eixo_(k[1])} em {k[0]}")
    taxas25 = {r: eixo[(2025, r)]["liq"] / eixo[(2025, r)]["plan"] * 100 for r in ROMANOS}
    alto, baixo = max(taxas25, key=taxas25.get), min(taxas25, key=taxas25.get)
    entrada(
        "b1-execucao-eixo-2024-2025.png",
        "Liquidado OSG e execução por eixo temático, 2024 e 2025",
        "Quanto foi liquidado em cada eixo da Lei nº 4.168/2023 em 2024 e 2025, e a execução de cada um.",
        ler_execucao,
        [
            f"Maior execução em 2025: {nome_eixo_(alto)} ({pct(taxas25[alto])}); menor: {nome_eixo_(baixo)} "
            f"({pct(taxas25[baixo])}).",
            f"Maior liquidado em 2025: {nome_eixo_(max(ROMANOS, key=lambda r: eixo[(2025, r)]['liq']))}.",
            f"Liquidado acima do planejado: {_lista(acima)}.",
        ],
        [ressalva_100],
    )

    # b2
    v = {r: (eixo[(2025, r)]["plan"], eixo[(2026, r)]["plan"]) for r in ROMANOS}
    entrada(
        "b2-planejado-eixo-2025-2026.png",
        "Valor planejado OSG por eixo temático, 2025 e 2026",
        "O valor apropriado ao OSG em cada eixo, nos exercícios de 2025 e 2026.",
        ler_comparacao,
        _destaques_comparacao(v, nome_eixo_, mi, 2025, 2026),
        ["Os números de 2026 já incorporam a correção de 11/09/2026 (entrega da SEMULHER em Governança)."],
    )

    # b3
    v = {r: (deixo[(2025, r)]["n"], deixo[(2026, r)]["n"]) for r in ROMANOS}
    entrada(
        "b3-dotacoes-eixo-2025-2026.png",
        "Número de dotações por eixo temático, 2025 e 2026",
        "Quantas dotações têm entregas em cada eixo, em 2025 e 2026.",
        "Duas barras por eixo, uma por exercício. Na barra de 2026, em cinza, a diferença em número de "
        "dotações e, entre parênteses, em percentual.",
        [f"{nome_eixo_(r)}: {a} → {b}." for r, (a, b) in v.items()],
        [
            "Uma dotação conta em cada eixo em que tem entrega — a regra do painel. Em 2025 e 2026 nenhuma "
            f"dotação mistura eixos, e os eixos somam exatamente o total ({ndot[2025]} e {ndot[2026]}).",
        ],
    )

    # b4 e b5
    total_liq = sum(eixo[(2025, r)]["liq"] for r in ROMANOS)
    partes = sorted(ROMANOS, key=lambda r: -eixo[(2025, r)]["liq"])
    destaques_dist = [
        "Participação no liquidado de 2025, da maior para a menor: "
        + _lista([f"{nome_eixo_(r)} {pct(eixo[(2025, r)]['liq'] / total_liq * 100)}" for r in partes])
        + ".",
        f"Total liquidado em 2025: R$ {reais(tot[2025][1])}.",
    ]
    entrada(
        "b4-distribuicao-liquidado-eixo-2025-barras.png",
        "Distribuição do liquidado OSG por eixo temático, 2025",
        "A participação de cada eixo no total liquidado em 2025, com o valor em reais.",
        "Uma barra por eixo, na ordem da lei. O percentual está na ponta da barra e o valor, em cinza, ao lado.",
        destaques_dist,
        ["Mesmos números da rosca (b5): são duas apresentações do mesmo dado, para escolher a que o texto pedir."],
    )
    entrada(
        "b5-distribuicao-liquidado-eixo-2025-rosca.png",
        "Distribuição do liquidado OSG por eixo temático, 2025",
        "A participação de cada eixo no total liquidado em 2025, em forma de rosca.",
        "As fatias começam no alto e seguem no sentido horário, na ordem da lei (I a VI); o total está no centro "
        "e cada eixo tem percentual e valor escritos na legenda.",
        destaques_dist,
        [
            "As cores são as dos eixos no painel. A fatia de Governança é muito fina; o valor está na legenda.",
            "Mesmos números das barras (b4).",
        ],
    )

    # b6
    entrada(
        "b6-execucao-eixo-2025.png",
        "Planejado, liquidado e execução OSG por eixo temático, 2025",
        "Para cada eixo da Lei nº 4.168/2023, o valor planejado e o liquidado de 2025 lado a lado, com a execução.",
        ler_plan_liq,
        destaques_plan_liq(eixo, ROMANOS, nome_eixo_),
        [
            ressalva_100,
            "O liquidado de 2025 é o mesmo do gráfico b1; aqui ele aparece ao lado do planejado de 2025, e não de 2024.",
        ],
    )

    # c1 e Tabela 1
    cods = sorted({c for (a, c) in fun if a in (2025, 2026)})
    v = {c: ((fun.get((2025, c)) or {}).get("plan"), (fun.get((2026, c)) or {}).get("plan")) for c in cods}
    novas = [nome_fun(c) for c in cods if not v[c][0]]
    saem = [nome_fun(c) for c in cods if not v[c][1]]
    destaques_c1 = [
        f"{len(cods)} funções com valor em 2025 ou 2026: "
        f"{sum(1 for c in cods if v[c][0])} em 2025 e {sum(1 for c in cods if v[c][1])} em 2026.",
        f"Novas em 2026: {_lista(novas)}. Sem planejado em 2026: {_lista(saem)}.",
    ] + _destaques_comparacao(v, nome_fun, valor_curto, 2025, 2026)
    ressalva_funcao = (
        "A função vem da aba “Dotações” da exportação (a de entregas não a traz). Nenhuma dotação mistura "
        "funções, e a soma por função é a mesma do painel."
    )
    entrada(
        "c1-planejado-funcao-2025-2026.png",
        "Valor planejado OSG por função orçamentária, 2025 e 2026",
        "O valor apropriado ao OSG em cada função orçamentária, nos exercícios de 2025 e 2026.",
        ler_comparacao
        + " “sem dotação” marca a função que não existe no exercício; “nova em 2026”, a que só aparece em 2026. "
        "Valores abaixo de R$ 1 milhão estão em milhares (“R$ 587 mil”).",
        destaques_c1,
        [ressalva_funcao, "Os valores exatos, com centavos, estão na Tabela 1 (c-tabelas-funcoes.docx)."],
    )

    # c2 e Tabela 2
    cods = sorted({c for (a, c) in fun if a in (2024, 2025)})
    so24 = [nome_fun(c) for c in cods if (2025, c) not in fun]
    so25 = [nome_fun(c) for c in cods if (2024, c) not in fun]
    acima24 = _acima_de_100({c: fun.get((2024, c)) for c in cods}, nome_fun)
    acima25 = _acima_de_100({c: fun.get((2025, c)) for c in cods}, nome_fun)
    destaques_c2 = [
        f"Execução total: {execucao_total(2024)} em 2024 e {execucao_total(2025)} em 2025.",
        f"Liquidado acima do planejado em 2024: {_lista(acima24)}.",
        f"Liquidado acima do planejado em 2025: {_lista(acima25)}.",
        f"Sem dotação em 2025: {_lista(so24)}. Sem dotação em 2024: {_lista(so25)}.",
    ]
    entrada(
        "c2-execucao-funcao-2024-2025.png",
        "Liquidado OSG e execução por função orçamentária, 2024 e 2025",
        "Quanto foi liquidado em cada função orçamentária em 2024 e 2025, e a execução de cada uma.",
        ler_execucao + " “sem dotação” marca a função que não existe no exercício.",
        destaques_c2,
        [
            ressalva_100 + " Em funções de valor pequeno a taxa pode ficar muito alta — por exemplo, "
            "Administração em 2024.",
            ressalva_funcao,
            "Os valores exatos estão na Tabela 2 (c-tabelas-funcoes.docx).",
        ],
    )

    # c3 e Tabela 3
    cods = sorted(c for (a, c) in fun if a == 2025)
    taxas = {c: fun[(2025, c)]["liq"] / fun[(2025, c)]["plan"] * 100 for c in cods}
    maior = max(cods, key=lambda c: fun[(2025, c)]["plan"])
    destaques_c3 = [
        f"Maior planejado em 2025: {nome_fun(maior)}, com {valor_curto(fun[(2025, maior)]['plan'])} "
        f"e execução de {pct(taxas[maior])}.",
        f"Menor execução: {nome_fun(min(taxas, key=taxas.get))} ({pct(min(taxas.values()))}).",
        f"Liquidado acima do planejado: {_lista(acima25)}.",
    ]
    entrada(
        "c3-execucao-funcao-2025.png",
        "Planejado, liquidado e execução OSG por função orçamentária, 2025",
        "Para cada função com dotação em 2025, o valor planejado e o liquidado lado a lado, com a execução.",
        "Duas barras por função: planejado (verde) e liquidado (lilás). A execução está em cinza, ao lado do "
        "liquidado.",
        destaques_c3,
        [ressalva_100, ressalva_funcao, "Os valores exatos estão na Tabela 3 (c-tabelas-funcoes.docx)."],
    )

    entrada(
        "c-tabelas-funcoes.docx (Tabelas 1, 2 e 3)",
        "Tabela 1 – Valor planejado OSG por função orçamentária, 2025 e 2026; Tabela 2 – Liquidado OSG e "
        "execução por função orçamentária, 2024 e 2025; Tabela 3 – Planejado, liquidado e execução OSG por "
        "função orçamentária, 2025 (os títulos já estão no arquivo e podem ser editados).",
        "Os mesmos três comparativos dos gráficos c1, c2 e c3, em tabelas editáveis, com valores exatos em "
        "reais e centavos.",
        "Funções na ordem do código. “—” indica função sem dotação no exercício. A linha Total repete o total "
        "do exercício no painel.",
        [
            f"Tabela 1: {len({c for (a, c) in fun if a in (2025, 2026)})} funções; total {mi(tot[2025][0])} → "
            f"{mi(tot[2026][0])}.",
            f"Tabela 2: {len({c for (a, c) in fun if a in (2024, 2025)})} funções; execução total "
            f"{execucao_total(2024)} → {execucao_total(2025)}.",
            f"Tabela 3: {len(cods)} funções; execução total de {execucao_total(2025)} em 2025.",
        ],
        [
            "Os centavos batem com os do painel: as somas seguem a mesma ordem e o mesmo arredondamento da tela.",
        ],
    )

    # d1 e Tabela 4
    org, uni = dados["orgao"], dados["unidade"]
    cods = ordem_orgaos(dados)
    sigla = lambda c: sigla_curta(dados["nomes_orgao"][c])  # noqa: E731
    v = {c: (_planejado(org, 2025, c), _planejado(org, 2026, c)) for c in cods}
    novos = [sigla(c) for c in cods if v[c][0] is None]
    sem_2026 = [sigla(c) for c in cods if v[c][1] is None]
    entrada(
        "d1-planejado-orgao-2025-2026.png",
        "Valor planejado OSG por órgão executor, 2025 e 2026",
        "O valor apropriado ao OSG em cada órgão executor, somando todas as suas unidades, nos exercícios de "
        "2025 e 2026.",
        ler_comparacao
        + " Os órgãos aparecem pela sigla e vão do maior para o menor valor planejado em 2026; “sem dotação” e "
        "“nova em 2026” como nos demais gráficos. Valores abaixo de R$ 1 milhão estão em milhares.",
        [
            f"{len(cods)} órgãos com valor em 2025 ou 2026: {sum(1 for c in cods if v[c][0] is not None)} em "
            f"2025 e {sum(1 for c in cods if v[c][1] is not None)} em 2026.",
            f"Novos em 2026: {_lista(novos)}. Sem planejado em 2026: {_lista(sem_2026)}.",
        ]
        + _destaques_comparacao(v, sigla, valor_curto, 2025, 2026),
        ["Os nomes completos dos órgãos e o detalhe por unidade estão na Tabela 4 (d-tabela-orgaos-unidades.docx)."],
    )
    chaves_u = sorted({k for (a, k) in uni if a in (2025, 2026)})
    vu = {k: (_planejado(uni, 2025, k), _planejado(uni, 2026, k)) for k in chaves_u}
    nome_u = lambda k: f"{sigla(k.split('/')[0])} · {k.split('/')[1]} {dados['nomes_unidade'][k]}"  # noqa: E731
    entrada(
        "d-tabela-orgaos-unidades.docx (Tabela 4)",
        "Tabela 4 – Valor planejado OSG por órgão e unidade executora, 2025 e 2026 (o título já está no arquivo "
        "e pode ser editado).",
        "O planejado de 2025 e 2026 por órgão executor e, dentro de cada órgão, por unidade orçamentária, com "
        "valores exatos em reais e centavos.",
        "Em negrito, o órgão (soma das suas unidades); abaixo, recuadas, as suas unidades. Mesma ordem do gráfico "
        "d1. “—” indica sem dotação no exercício. A linha Total repete o total do exercício no painel.",
        [
            f"{sum(1 for k in chaves_u if vu[k][0] is not None)} unidades com valor em 2025 e "
            f"{sum(1 for k in chaves_u if vu[k][1] is not None)} em 2026, em {len(cods)} órgãos.",
        ]
        + _destaques_comparacao(vu, nome_u, valor_curto, 2025, 2026, em_reais=True),
        [
            f"{unidades_gestoras} unidades se chamam “Unidade Gestora” — uma em cada órgão —, e por isso cada "
            "unidade aparece sob o seu órgão.",
        ],
    )

    # d2 e Tabela 5
    o25 = {c: org[(2025, c)] for (a, c) in org if a == 2025}
    taxas_o = {c: g["liq"] / g["plan"] * 100 for c, g in o25.items() if g["plan"]}
    maior_liq = max(o25, key=lambda c: o25[c]["liq"])
    menor_exec = min(taxas_o, key=taxas_o.get)
    entrada(
        "d2-execucao-orgao-2025.png",
        "Planejado, liquidado e execução OSG por órgão executor, 2025",
        "Para cada órgão com dotação em 2025, o valor planejado e o liquidado lado a lado, com a execução.",
        "Duas barras por órgão: planejado (verde) e liquidado (lilás), com a execução em cinza ao lado do "
        "liquidado. Os órgãos aparecem pela sigla, do maior para o menor valor liquidado. Valores abaixo de "
        "R$ 1 milhão estão em milhares.",
        [
            f"Execução total em 2025: {execucao_total(2025)}.",
            f"Maior liquidado: {sigla(maior_liq)}, com {valor_curto(o25[maior_liq]['liq'])} "
            f"({pct(taxas_o[maior_liq])} do planejado).",
            f"Menor execução: {sigla(menor_exec)} ({pct(taxas_o[menor_exec])}).",
            f"Liquidado acima do planejado: {_lista(_acima_de_100(o25, sigla))}.",
        ],
        [ressalva_100, "Os nomes completos e o detalhe por unidade estão na Tabela 5 (d-tabela-orgaos-unidades.docx)."],
    )
    u25 = {k: uni[(2025, k)] for (a, k) in uni if a == 2025}
    acima_u = [k for k, g in u25.items() if g["plan"] and g["liq"] > g["plan"]]
    # A menor base positiva: é onde a taxa de execução perde o sentido.
    menor_base = min((k for k in u25 if u25[k]["plan"]), key=lambda k: u25[k]["plan"])
    b = u25[menor_base]
    entrada(
        "d-tabela-orgaos-unidades.docx (Tabela 5)",
        "Tabela 5 – Planejado, liquidado e execução OSG por órgão e unidade executora, 2025 (o título já está "
        "no arquivo e pode ser editado).",
        "O planejado, o liquidado e a execução de 2025 por órgão executor e, dentro de cada órgão, por unidade "
        "orçamentária, com valores exatos em reais e centavos.",
        "Em negrito, o órgão (soma das suas unidades); abaixo, recuadas, as suas unidades. Mesma ordem do gráfico "
        "d2 (maior liquidado primeiro). A linha Total repete o total do exercício no painel.",
        [
            f"{len(u25)} unidades com dotação em 2025, em {len(o25)} órgãos.",
            f"{len(acima_u)} unidades com liquidado acima do planejado.",
        ],
        [
            "Execução acima de 100% indica liquidado superior ao planejado; a tabela mostra a taxa como ela é, sem "
            "limitar a 100%.",
            f"Em unidades de planejado muito pequeno a taxa perde o sentido: {nome_u(menor_base)} tem "
            f"R$ {reais(b['plan'])} planejados e {valor_curto(b['liq'])} liquidados ({pct(b['liq'] / b['plan'] * 100)}).",
        ],
    )

    # e1
    entrada(
        "e1-planejado-total-2024-2025-2026.png",
        "Valor planejado OSG, total do exercício, 2024 a 2026",
        "O valor total apropriado ao OSG em cada um dos três exercícios apurados, sem recorte por categoria, "
        "eixo, função ou órgão.",
        "Uma barra por exercício, do mais antigo para o mais recente. Ao lado do valor, em cinza, a variação "
        "sobre o exercício anterior; na barra de 2026, também a variação sobre 2024, primeiro ano de apuração.",
        [
            f"Planejado: {mi(tot[2024][0])} em 2024, {mi(tot[2025][0])} em 2025 e {mi(tot[2026][0])} em 2026.",
            f"De 2025 para 2026: {_var(tot[2025][0], tot[2026][0])}.",
            f"De 2024 para 2026, o período inteiro de apuração: {_var(tot[2024][0], tot[2026][0])}.",
            f"Dotações: {ndot[2024]} em 2024, {ndot[2025]} em 2025 e {ndot[2026]} em 2026.",
        ],
        [
            "Valores em reais correntes, sem correção pela inflação: a comparação entre exercícios é nominal, e "
            "parte do crescimento apenas acompanha a variação de preços.",
            "Cada exercício tem a sua própria lei orçamentária, por isso os valores não se somam.",
        ],
    )

    # e2
    entrada(
        "e2-execucao-total-2025.png",
        "Planejado, liquidado e execução OSG, total do exercício, 2025",
        "O total planejado e o total liquidado do OSG em 2025, com a taxa de execução do exercício.",
        "Duas barras: o planejado (verde) e o liquidado (lilás), com a execução em cinza ao lado do liquidado — "
        "quanto do planejado do exercício foi liquidado.",
        [
            f"Planejado {mi(tot[2025][0])} e liquidado {mi(tot[2025][1])}.",
            f"Execução do exercício: {execucao_total(2025)}.",
            f"Diferença entre o planejado e o liquidado: {mi(tot[2025][0] - tot[2025][1])}.",
            f"Para comparar, a execução de 2024 foi de {execucao_total(2024)}.",
        ],
        [
            "2026 não aparece: o exercício está em apuração e o painel não publica o liquidado enquanto o COSG "
            "não fecha o ano.",
            "O detalhamento desta mesma execução, por órgão, unidade e dotação, está na Tabela 6.",
        ],
    )

    # Tabela 6
    d25 = {k: g for (a, k), g in dados["dot"].items() if a == 2025}
    maior = max(d25, key=lambda k: d25[k]["liq"])
    textos_por_unidade: dict[tuple, list] = {}
    for k in d25:
        textos_por_unidade.setdefault((k[0], k[1], dados["aplicacao"][(2025, k)]), []).append(k)
    com_repeticao = sorted({sigla(t[0]) for t, ks in textos_por_unidade.items() if len(ks) > 1})
    entrada(
        "e-tabela-execucao-2025.docx (Tabela 6)",
        "Tabela 6 – Detalhamento da execução OSG de 2025 por órgão, unidade e aplicação programada (o título já "
        "está no arquivo e pode ser editado).",
        "O planejado, o liquidado e a execução de 2025 de cada dotação — identificada pela aplicação programada e "
        "pelo código do projeto/atividade —, agrupadas por unidade orçamentária e por órgão executor.",
        "Três níveis: em negrito, o órgão (soma das suas unidades); em itálico e recuada, a unidade (soma das suas "
        "dotações); mais recuada, cada aplicação programada. Do maior para o menor liquidado em cada nível. A linha "
        "Total repete o total do exercício no painel.",
        [
            f"{len(d25)} dotações em {len({k[:2] for k in d25})} unidades e {len({k[0] for k in d25})} órgãos.",
            f"Maior liquidado: {dados['aplicacao'][(2025, maior)].upper()} ({sigla(maior[0])}, projeto/atividade "
            f"{maior[2]}), com {valor_curto(d25[maior]['liq'])} "
            f"({pct(d25[maior]['liq'] / d25[maior]['plan'] * 100)} do planejado).",
            f"{sum(1 for g in d25.values() if not g['liq'])} dotações sem liquidado em 2025 e "
            f"{sum(1 for g in d25.values() if g['plan'] and g['liq'] > g['plan'])} com liquidado acima do planejado.",
        ],
        [
            "Execução acima de 100% indica liquidado superior ao planejado; em dotações de planejado muito pequeno a "
            "taxa perde o sentido.",
            "A aplicação programada foi padronizada em maiúsculas: o texto de origem mistura as duas formas.",
            "Os subtotais de unidade e de órgão são somas exatas, como no painel; a soma das linhas exibidas pode "
            "diferir deles em centavos, por arredondamento.",
            "O código do projeto/atividade distingue dotações com o mesmo texto"
            + (f" — é o caso de {_lista(com_repeticao)}." if com_repeticao else "."),
        ],
    )

    caminho = os.path.join(SAIDA, "notas-explicativas.docx")
    doc.save(caminho)
    return caminho


# --------------------------------------------------------------------------- #


def conferir(dados: dict, entregas: list[dict], nomes_funcao: dict[str, str]) -> None:
    """Tabela no console e CSV em saida/, para conferir contra o painel."""
    anos = sorted({e["ano"] for e in entregas})
    agrupamentos = (
        ("Categoria", "cat", CATEGORIAS, str),
        ("Eixo", "eixo", ROMANOS, lambda r: next(f"{r} {nome}" for rr, nome, _ in EIXOS if rr == r)),
        ("Função", "funcao", tuple(sorted(nomes_funcao)), lambda c: f"{c} {nomes_funcao[c]}"),
        ("Órgão", "orgao", tuple(sorted(dados["nomes_orgao"])), lambda c: f"{c} {dados['nomes_orgao'][c]}"),
        ("Unidade", "unidade", tuple(sorted(dados["nomes_unidade"])), lambda k: f"{k} {dados['nomes_unidade'][k]}"),
    )
    linhas_csv = []
    for titulo, chave, grupos, rotulo in agrupamentos:
        print(f"\n  {titulo.lower():<44}      planejado          liquidado   execução  dotações")
        for ano in anos:
            # Liquidado do exercício somado pelos grupos, base da participação.
            # None se algum grupo não tiver liquidado (exercício em apuração).
            liqs = [dados[chave][(ano, gr)]["liq"] for gr in grupos if (ano, gr) in dados[chave]]
            tot_liq_grupos = None if any(v is None for v in liqs) else sum(liqs)
            for grupo in grupos:
                g = dados[chave].get((ano, grupo))
                if g is None:
                    continue
                n = dados[f"dot_{chave}"][(ano, grupo)]["n"]
                participacao = None if tot_liq_grupos is None or not tot_liq_grupos else g["liq"] / tot_liq_grupos * 100
                execucao = None if g["liq"] is None or not g["plan"] else g["liq"] / g["plan"] * 100
                print(
                    f"  {ano}  {rotulo(grupo):<38} {reais(g['plan']):>18}  "
                    f"{'em apuração' if g['liq'] is None else reais(g['liq']):>17}  "
                    f"{'' if execucao is None else pct(execucao):>9}  {n:>8}"
                )
                linhas_csv.append(
                    [
                        ano,
                        titulo,
                        rotulo(grupo),
                        _br(g["plan"], 2).replace(".", ""),
                        "" if g["liq"] is None else _br(g["liq"], 2).replace(".", ""),
                        "" if execucao is None else _br(execucao, 1),
                        n,
                        "" if participacao is None else _br(participacao, 1),
                    ]
                )

    # Por dotação (Tabela 6): só no CSV. No console seriam quase 300 linhas, e
    # a tabela de conferência acima deixaria de ser lida.
    for ano in anos:
        do_ano = {k: g for (a, k), g in dados["dot"].items() if a == ano}
        liqs = [g["liq"] for g in do_ano.values()]
        tot_liq_dot = None if any(v is None for v in liqs) else sum(liqs)
        for k in sorted(do_ano):
            g = do_ano[k]
            execucao = None if g["liq"] is None or not g["plan"] else g["liq"] / g["plan"] * 100
            participacao = None if not tot_liq_dot or g["liq"] is None else g["liq"] / tot_liq_dot * 100
            linhas_csv.append(
                [
                    ano,
                    "Dotação",
                    f"{'/'.join(k)} {dados['aplicacao'][(ano, k)]}",
                    _br(g["plan"], 2).replace(".", ""),
                    "" if g["liq"] is None else _br(g["liq"], 2).replace(".", ""),
                    "" if execucao is None else _br(execucao, 1),
                    1,
                    "" if participacao is None else _br(participacao, 1),
                ]
            )

    print(f"\n  {'total do exercício':<44}      planejado          liquidado             dotações")
    for ano in anos:
        tot_plan, tot_liq = totais_do_ano(entregas, ano)
        # Dotações distintas do exercício, sem agrupamento — o número que o
        # painel publica (121 em 2026). A soma por categoria pode passar dele.
        dotacoes = len({e["dot"] for e in entregas if e["ano"] == ano})
        execucao = None if tot_liq is None or not tot_plan else tot_liq / tot_plan * 100
        print(
            f"  {ano}  {'':<38} {reais(tot_plan):>18}  "
            f"{'em apuração' if tot_liq is None else reais(tot_liq):>17}  "
            f"{'' if execucao is None else pct(execucao):>9}  {dotacoes:>8}"
        )
        # No CSV também, e não só no console: são estes os números por trás das
        # barras da família (e), e o cabeçalho do arquivo promete que o CSV traz
        # o que está por trás de cada barra. A participação fica vazia — sobre o
        # total do exercício ela seria sempre 100%.
        linhas_csv.append(
            [
                ano,
                "Total do exercício",
                "Total do OSG",
                _br(tot_plan, 2).replace(".", ""),
                "" if tot_liq is None else _br(tot_liq, 2).replace(".", ""),
                "" if execucao is None else _br(execucao, 1),
                dotacoes,
                "",
            ]
        )

    # `;` e vírgula decimal, com BOM: é o que o Excel em português abre direto.
    with open(os.path.join(SAIDA, "dados-graficos.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(
            [
                "Exercício", "Agrupamento", "Grupo", "Valor planejado OSG", "Liquidado OSG", "Execução (%)",
                "Dotações", "Participação no liquidado (%)",
            ]
        )
        w.writerows(linhas_csv)


def main() -> None:
    caminhos = sys.argv[1:] or sorted(glob.glob(os.path.join(DADOS, "*.xlsx")))
    # Arquivo temporário do Excel aberto ("~$osg-...xlsx") não é planilha.
    caminhos = [c for c in caminhos if not os.path.basename(c).startswith("~$")]
    if not caminhos:
        sys.exit(f"Nenhum XLSX em {DADOS}. Exporte do painel e copie para lá, ou passe os caminhos.")

    os.makedirs(SAIDA, exist_ok=True)
    print("Exportações lidas:")
    entregas = carregar_entregas(caminhos)
    mapa_funcao, aba_por_funcao, datas = carregar_dotacoes(caminhos)
    conferir_abas(entregas, aba_por_funcao)
    funcoes = somar_por_funcao(entregas, mapa_funcao)
    dados = agregar(entregas)
    # Total do exercício, sem agrupamento: é o que a família (e) desenha. Entra
    # aqui, e não em `agregar`, porque depende de `totais_do_ano` — a mesma
    # conta do `calcularTotais` do painel, entrega a entrega — e não das somas
    # por grupo, cuja ordem de soma pode diferir num centavo.
    dados["total"] = {
        ano: dict(zip(("plan", "liq"), totais_do_ano(entregas, ano)))
        for ano in sorted({e["ano"] for e in entregas})
    }
    dados["funcao"] = {k: {"plan": f["plan"], "liq": f["liq"]} for k, f in funcoes.items()}
    dados["dot_funcao"] = {k: {"n": f["n"]} for k, f in funcoes.items()}
    dados["nomes_funcao"] = {cod: f["nome"] for (_, cod), f in sorted(funcoes.items())}
    conferir(dados, entregas, dados["nomes_funcao"])

    aplicar_estilo()
    print()
    for nome, funcao in GRAFICOS:
        fig = funcao(dados)
        fig.savefig(os.path.join(SAIDA, nome), dpi=DPI)
        plt.close(fig)
        print(f"  saida/{nome}")
    print(f"  saida/{os.path.basename(tabelas_funcoes(funcoes, entregas, datas))}")
    print(f"  saida/{os.path.basename(tabela_orgaos_unidades(dados, entregas, datas))}")
    print(f"  saida/{os.path.basename(tabela_execucao_2025(dados, entregas, datas))}")
    print(f"  saida/{os.path.basename(notas_explicativas(dados, entregas, datas))}")


if __name__ == "__main__":
    main()
