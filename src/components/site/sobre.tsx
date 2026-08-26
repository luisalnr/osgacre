import Image from "next/image";
import { Check, X } from "lucide-react";
import { SOBRE } from "@/lib/conteudo";
import { CATEGORIAS } from "@/lib/referencias";
import { Card, Etiqueta, Secao, TituloSecao } from "@/components/ui/primitivos";

export function Sobre() {
  return (
    <Secao id="sobre">
      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <TituloSecao sobretitulo="Lei nº 4.168/2023" titulo={SOBRE.titulo} />
          <div className="space-y-4 text-base leading-relaxed text-texto-2">
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

        <div className="relative overflow-hidden rounded-card border border-borda bg-superficie-2">
          <Image
            src="/ilustracoes/mulheres-faixa.png"
            alt="Ilustração de cinco mulheres de perfis diversos lado a lado"
            width={1536}
            height={1024}
            className="h-full w-full object-cover"
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

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {CATEGORIAS.map((c) => (
            <Card key={c.numero} className="p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-lilas-claro text-sm font-semibold text-lilas">
                  {c.numero}
                </span>
                <Etiqueta tom="lilas">{c.regra}</Etiqueta>
              </div>
              <h4 className="text-sm font-semibold text-texto">{c.titulo}</h4>
              <p className="mt-2 text-sm leading-relaxed text-texto-2">{c.descricao}</p>
            </Card>
          ))}
        </div>
      </div>
    </Secao>
  );
}
