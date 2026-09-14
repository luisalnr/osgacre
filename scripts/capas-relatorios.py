"""
Gera as capas dos cartões de `#relatorios` a partir da página 1 de cada PDF.

    python -m pip install pymupdf
    python scripts/capas-relatorios.py

Lê `public/relatorios/*.pdf` e grava um PNG por PDF em `public/relatorios/capas/`,
com o mesmo nome em minúsculas e sem o prefixo `SEPLAN-`. Depois é preciso apontar
o campo `capa` do registro correspondente em `RELATORIOS` (`src/lib/conteudo.ts`)
para o arquivo gerado — o cartão renderiza sem imagem enquanto isso não for feito.

Os PDFs são A4 retrato (595x842 pt). A 150 DPI a capa sai com ~1240x1754 px, o
dobro da largura em que o cartão a exibe na grade de três colunas: sobra
resolução para telas 2x sem estourar o peso do repositório. Se algum PNG passar
de ~1,2 MB, vale reencodar em JPEG q=90 — a arte das capas comprime bem, e o
`next/image` serve WebP/AVIF derivado de qualquer um dos dois formatos.
"""

import os
import sys

try:
    import pymupdf
except ImportError:
    sys.exit("Falta o PyMuPDF. Rode: python -m pip install pymupdf")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEM = os.path.join(RAIZ, "public", "relatorios")
DESTINO = os.path.join(ORIGEM, "capas")

DPI = 150


def nome_da_capa(pdf: str) -> str:
    return pdf.removesuffix(".pdf").removeprefix("SEPLAN-").lower() + ".png"


def main() -> None:
    os.makedirs(DESTINO, exist_ok=True)
    matriz = pymupdf.Matrix(DPI / 72, DPI / 72)

    pdfs = sorted(f for f in os.listdir(ORIGEM) if f.lower().endswith(".pdf"))
    if not pdfs:
        sys.exit(f"Nenhum PDF em {ORIGEM}")

    for pdf in pdfs:
        with pymupdf.open(os.path.join(ORIGEM, pdf)) as doc:
            # `alpha=False`: as capas são opacas e o canal extra só engordaria
            # o arquivo.
            pix = doc[0].get_pixmap(matrix=matriz, alpha=False)

        saida = os.path.join(DESTINO, nome_da_capa(pdf))
        pix.save(saida)
        mb = os.path.getsize(saida) / 1024 / 1024
        print(f"{pdf} -> capas/{nome_da_capa(pdf)}  {pix.width}x{pix.height}  {mb:.2f} MB")


if __name__ == "__main__":
    main()
