"""
Gera os ícones do site a partir de um PNG da marca.

    python -m pip install pillow
    python scripts/icones.py "LOGO GOVERNO DO ACRE 2023-2026 brasão.png"

Grava `src/app/icon.png` (64x64) e `src/app/apple-icon.png` (180x180). O Next
detecta os dois pela convenção de arquivo do App Router e emite as tags
sozinho, com URL versionada e cache longo — não há nada a declarar em
`metadata.icons`.

Existe como script, e não como conversão feita uma vez na mão, porque a marca é
datada: "LOGO GOVERNO DO ACRE 2023-2026" muda de gestão, e aí basta apontar
este comando para o arquivo novo.

Três cuidados que o resultado depende:

* **Recorte pelo alfa.** A arte vem com margem transparente em volta. Sem
  recortar, essa margem consome parte dos 64 px e o brasão chega menor do que
  poderia à aba.
* **Tela quadrada, não esticada.** O brasão é 1846x1814. Esticar para quadrado
  distorce o emblema; centralizar numa tela do lado maior preserva a proporção.
* **Lanczos.** É a reamostragem que segura as linhas finas das hachuras. As
  rápidas transformam o brasão em papa.

O ícone da Apple é achatado sobre **branco**: o iOS compõe transparência sobre
preto, e o contorno preto do brasão desapareceria no fundo.
"""

import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Falta o Pillow. Rode: python -m pip install pillow")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "src", "app")

# (arquivo, lado, fundo) — fundo None mantém a transparência.
SAIDAS = [
    ("icon.png", 64, None),
    ("apple-icon.png", 180, (255, 255, 255)),
]


def quadrada(im: Image.Image) -> Image.Image:
    """Recorta a moldura transparente e centraliza numa tela quadrada."""
    im = im.convert("RGBA")
    caixa = im.getbbox()  # menor retângulo com pixel não transparente
    if caixa:
        im = im.crop(caixa)
    lado = max(im.size)
    tela = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    tela.paste(im, ((lado - im.width) // 2, (lado - im.height) // 2))
    return tela


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit('Informe o PNG da marca. Ex.: python scripts/icones.py "brasao.png"')
    origem = sys.argv[1]
    if not os.path.exists(origem):
        sys.exit(f"Não encontrei {origem}")

    base = quadrada(Image.open(origem))
    print(f"origem: {origem} — recortada para {base.width}x{base.height}")

    for nome, lado, fundo in SAIDAS:
        icone = base.resize((lado, lado), Image.LANCZOS)
        if fundo is not None:
            chapa = Image.new("RGB", (lado, lado), fundo)
            chapa.paste(icone, mask=icone.split()[3])  # canal alfa como máscara
            icone = chapa
        caminho = os.path.join(DESTINO, nome)
        icone.save(caminho, "PNG", optimize=True)
        kb = os.path.getsize(caminho) / 1024
        print(f"  {nome:16} {lado}x{lado}  {kb:6.1f} KB")


if __name__ == "__main__":
    main()
