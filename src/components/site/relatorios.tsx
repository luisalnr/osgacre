import { Download, FileText } from "lucide-react";
import { RELATORIOS } from "@/lib/conteudo";
import { Card, Etiqueta, Secao, TituloSecao } from "@/components/ui/primitivos";

export function Relatorios() {
  return (
    <Secao id="relatorios" className="bg-superficie-2/60">
      <TituloSecao
        sobretitulo="Publicações"
        titulo="Relatórios e manuais"
        descricao="Documentos publicados pela SEPLAN sobre o Orçamento Sensível ao Gênero do Estado do Acre."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {RELATORIOS.map((r) => (
          <Card key={r.arquivo} className="flex flex-col p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-lilas-claro text-lilas">
                <FileText className="size-5" aria-hidden />
              </span>
              <Etiqueta tom={r.tipo === "Guia" ? "verde" : "neutro"}>{r.tipo}</Etiqueta>
            </div>

            <h3 className="text-base font-semibold text-texto">{r.titulo}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-texto-2">
              {r.descricao}
            </p>

            <a
              href={r.arquivo}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-borda-forte px-4 py-2.5 text-sm font-medium text-texto transition-colors hover:bg-superficie-2"
            >
              <Download className="size-4" aria-hidden />
              Abrir PDF
            </a>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-sm text-texto-3">
        O relatório com os registros do OSG planejados para 2026 será publicado
        aqui assim que os dados forem validados.
      </p>
    </Secao>
  );
}
