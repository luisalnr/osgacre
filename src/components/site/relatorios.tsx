import Image from "next/image";
import { Download, FileText } from "lucide-react";
import { RELATORIOS } from "@/lib/conteudo";
import { Card, Secao, TituloSecao } from "@/components/ui/primitivos";

export function Relatorios() {
  return (
    <Secao id="relatorios" className="bg-superficie-2/60">
      <TituloSecao
        sobretitulo="Publicações"
        titulo="Relatórios e manuais"
        descricao="Documentos publicados pela SEPLAN sobre o Orçamento Sensível ao Gênero do Estado do Acre."
      />

      {/* Teto próprio, mais estreito que a faixa de conteúdo. A capa é A4, então
          a altura do cartão é a largura vezes 1,414: na faixa cheia de 110rem cada
          cartão daria ~549px e a capa passaria de 770px de altura — uma tela por
          publicação. Em 64rem o cartão fica com ~325px e a capa com ~460px, que é
          cartaz de estante e não pôster. `gap-6` porque 16px entre duas artes
          grandes fica apertado. */}
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
        {RELATORIOS.map((r) => (
          /* O cartão inteiro é o link. Capa e botão levam ao mesmo PDF, e dois
             links idênticos por cartão só rendem parada de tabulação repetida e
             leitura duplicada. O `Abrir PDF` fica como afordância visual. */
          <a
            key={r.arquivo}
            href={r.arquivo}
            target="_blank"
            rel="noreferrer noopener"
            className="group block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lilas"
          >
            {/* `p-0` porque a capa é full-bleed; `overflow-hidden` para ela
                respeitar o `rounded-card`; `h-full` para os três cartões
                fecharem na mesma altura mesmo com descrições desiguais. */}
            <Card className="flex h-full flex-col overflow-hidden p-0 transition-shadow group-hover:shadow-card-alta">
              {/* A caixa tem exatamente a proporção do A4 de origem, então o
                  `object-cover` não corta nada. A borda inferior separa a capa
                  do corpo do cartão — as três têm fundo claro e, sem ela, o pé
                  da arte se dissolve no `bg-superficie` no tema claro. */}
              <div className="relative aspect-[1/1.414] w-full overflow-hidden border-b border-borda bg-superficie-2">
                {r.capa ? (
                  <Image
                    src={r.capa}
                    alt={`Capa do ${r.titulo}`}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-14 items-center justify-center rounded-lg bg-lilas-claro text-lilas">
                      <FileText className="size-7" aria-hidden />
                    </span>
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                {/* Sem etiqueta de tipo: a capa já diz se é relatório ou guia,
                    com muito mais clareza do que o rótulo repetido em três
                    cartões quase idênticos. `tipo` segue no dado para quem
                    precise filtrar. */}
                <h3 className="text-base font-semibold text-texto">{r.titulo}</h3>
                {/* O `flex-1` é o que prende o "Abrir PDF" no pé do cartão
                    quando as descrições têm alturas diferentes. */}
                <p className="mt-2 flex-1 text-sm leading-relaxed text-texto-2">
                  {r.descricao}
                </p>

                <span className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-borda-forte px-4 py-2.5 text-sm font-medium text-texto transition-colors group-hover:bg-superficie-2">
                  <Download className="size-4" aria-hidden />
                  Abrir PDF
                </span>
              </div>
            </Card>
          </a>
        ))}
      </div>

      <p className="mx-auto mt-6 max-w-5xl text-sm text-texto-3">
        O relatório com os registros do OSG planejados para 2026 será publicado
        aqui assim que os dados forem validados.
      </p>
    </Secao>
  );
}
