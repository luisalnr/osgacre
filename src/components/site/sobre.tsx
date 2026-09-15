import Image from "next/image";
import { Check, ExternalLink, X } from "lucide-react";
import { SOBRE } from "@/lib/conteudo";
import { CATEGORIAS } from "@/lib/referencias";
import { Secao, TituloSecao } from "@/components/ui/primitivos";

export function Sobre() {
  return (
    <Secao id="sobre">
      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <TituloSecao
            sobretitulo={
              <a
                href="https://legis.ac.gov.br/detalhar/5737"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lilas"
                aria-label="Abrir a Lei nº 4.168/2023 no Portal da Legislação do Estado do Acre"
              >
                Lei nº 4.168/2023
                <ExternalLink className="size-3" aria-hidden />
              </a>
            }
            titulo={SOBRE.titulo}
          />
          {/* Teto próprio: a coluna da grade acompanha a faixa alargada, e sem
              isto os parágrafos passariam de 130 caracteres por linha. */}
          <div className="max-w-2xl space-y-4 text-base leading-relaxed text-texto-2">
            {SOBRE.paragrafos.map((p) => (
              <p key={p.slice(0, 24)} className="text-pretty">
                {p}
              </p>
            ))}
          </div>

          <ul className="mt-8 space-y-3">
            {SOBRE.naoE.map((item, i) => {
              const negativo = item.startsWith("Não");
              const Icone = negativo ? X : Check;
              return (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className={
                      negativo
                        ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-superficie-2 text-texto-3"
                        : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-verde/10 text-verde"
                    }
                  >
                    <Icone className="size-3" aria-hidden />
                  </span>
                  <span className="text-sm leading-relaxed text-texto-2">{item}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Sem moldura e sem fundo: o PNG já vem recortado — alfa zero nos
            cantos e entre as folhas — e o cartão em `bg-superficie-2` desenhava
            atrás dele um retângulo cinza que a ilustração não tem. `object-contain`
            com altura automática porque `cover` recortava as figuras das pontas
            quando a coluna fica mais estreita que a arte. A arte é quadrada:
            o teto de largura a deixa com a altura do texto ao lado, e o
            `self-center` a alinha pelo meio da coluna em vez do topo. */}
        <div className="relative mx-auto w-full max-w-[26rem] lg:self-center">
          <Image
            src="/ilustracoes/mulheres_caminhando_sem_fundo.png"
            alt="Ilustração de cinco mulheres de perfis diversos caminhando juntas, uma delas com o punho erguido"
            width={1254}
            height={1254}
            className="h-auto w-full object-contain"
          />
        </div>
      </div>

      <div className="mt-16">
        <h3 className="text-xl font-semibold tracking-tight text-texto">
          Como uma dotação entra no OSG
        </h3>
        <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-texto-2">
          {SOBRE.comoApura}
        </p>

        {/* Mesma lista editorial dos eixos: filete no topo em vez de cartão, o
            número como rótulo em vez de selo, e a regra de apropriação — o que
            de fato distingue uma categoria da outra — como dado, não como pílula. */}
        <ol className="mt-8 grid border-b border-borda md:grid-cols-3 md:gap-x-10">
          {CATEGORIAS.map((c) => (
            <li key={c.numero} className="border-t border-borda py-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lilas">
                Categoria {c.numero}
              </p>
              <h4 className="mt-2 text-base font-semibold text-texto">{c.titulo}</h4>
              <p className="mt-1 text-sm text-texto-3">
                Apropriação:{" "}
                <span className="tabular font-semibold text-texto">{c.apropriacao}</span>
              </p>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-texto-2">
                {c.descricao}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </Secao>
  );
}
