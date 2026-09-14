"use client";

import { useMemo, useState } from "react";
import Image, { type StaticImageData } from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  Search,
  Target,
  type LucideIcon,
} from "lucide-react";
import ods1 from "../../../ODS_Logos/1.png";
import ods2 from "../../../ODS_Logos/2.png";
import ods3 from "../../../ODS_Logos/3.png";
import ods4 from "../../../ODS_Logos/4.png";
import ods5 from "../../../ODS_Logos/5.png";
import ods6 from "../../../ODS_Logos/6.png";
import ods7 from "../../../ODS_Logos/7.png";
import ods8 from "../../../ODS_Logos/8.png";
import ods9 from "../../../ODS_Logos/9.png";
import ods10 from "../../../ODS_Logos/10.png";
import ods11 from "../../../ODS_Logos/11.png";
import ods12 from "../../../ODS_Logos/12.png";
import ods13 from "../../../ODS_Logos/13.png";
import ods14 from "../../../ODS_Logos/14.png";
import ods15 from "../../../ODS_Logos/15.png";
import ods16 from "../../../ODS_Logos/16.png";
import ods17 from "../../../ODS_Logos/17.png";
import ods18 from "../../../ODS_Logos/18.png";
import { corDoEixo } from "@/lib/cores";
import {
  DADOS_ODS,
  ORDEM_STATUS_ODS,
  ROTULO_STATUS_ODS,
  type IndicadorOds,
  type StatusIndicadorOds,
} from "@/lib/ods";
import { chave, EIXOS, type EixoSlug } from "@/lib/referencias";
import { Card, Entrada } from "@/components/ui/primitivos";
import { cn } from "@/lib/utils";

const CHIP =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors";

const COR_STATUS: Record<StatusIndicadorOds, string> = {
  produzido: "bg-bom",
  "em-analise": "bg-alerta",
  "sem-dados": "bg-orange-500",
  "sem-metodologia": "bg-critico",
  "nao-se-aplica": "bg-texto-3",
};

const LOGOS_ODS: Record<number, StaticImageData> = {
  1: ods1,
  2: ods2,
  3: ods3,
  4: ods4,
  5: ods5,
  6: ods6,
  7: ods7,
  8: ods8,
  9: ods9,
  10: ods10,
  11: ods11,
  12: ods12,
  13: ods13,
  14: ods14,
  15: ods15,
  16: ods16,
  17: ods17,
  18: ods18,
};

const inteiro = new Intl.NumberFormat("pt-BR");

export function PainelOds() {
  const [objetivos, setObjetivos] = useState<number[]>([]);
  const [eixo, setEixo] = useState<EixoSlug | null>(null);
  const [status, setStatus] = useState<StatusIndicadorOds | null>(null);
  const [busca, setBusca] = useState("");

  const todos = useMemo(
    () =>
      DADOS_ODS.objetivos.flatMap((objetivo) =>
        objetivo.indicadores.map((indicador) => ({
          ...indicador,
          objetivo: objetivo.numero,
          objetivoTitulo: objetivo.titulo,
          cor: objetivo.cor,
        }))
      ),
    []
  );

  const filtrados = useMemo(() => {
    const termo = chave(busca);
    return todos.filter((indicador) => {
      if (objetivos.length && !objetivos.includes(indicador.objetivo)) return false;
      if (status && indicador.status !== status) return false;
      if (eixo && !indicador.eixos.includes(eixo)) return false;
      if (
        termo &&
        !chave(
          `${indicador.objetivo} ${indicador.objetivoTitulo} ${indicador.codigo} ${indicador.nome}`
        ).includes(termo)
      ) {
        return false;
      }
      return true;
    });
  }, [todos, objetivos, eixo, status, busca]);

  const porObjetivo = useMemo(() => {
    const mapa = new Map<number, typeof filtrados>();
    for (const indicador of filtrados) {
      const lista = mapa.get(indicador.objetivo) ?? [];
      lista.push(indicador);
      mapa.set(indicador.objetivo, lista);
    }
    return mapa;
  }, [filtrados]);

  const contemplados = porObjetivo.size;
  const produzidos = filtrados.filter(
    (indicador) => indicador.status === "produzido"
  ).length;
  const pendentes = filtrados.filter(
    (indicador) =>
      indicador.status === "em-analise" ||
      indicador.status === "sem-dados" ||
      indicador.status === "sem-metodologia"
  ).length;

  const alternarNumero = (numero: number) => {
    setObjetivos((atuais) =>
      atuais.includes(numero)
        ? atuais.filter((atual) => atual !== numero)
        : [...atuais, numero]
    );
  };

  const alternarEixo = (valor: EixoSlug) => {
    setEixo((atual) => (atual === valor ? null : valor));
  };

  const alternarStatus = (valor: StatusIndicadorOds) => {
    setStatus((atual) => (atual === valor ? null : valor));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Resumo
          titulo="Indicadores mapeados"
          valor={inteiro.format(filtrados.length)}
          nota="Correspondem aos filtros"
          icone={CheckCircle2}
        />
        <Resumo
          titulo="ODS contemplados"
          valor={`${contemplados}/18`}
          nota="Com ao menos um indicador"
          icone={Target}
        />
        <Resumo
          titulo="Indicadores produzidos"
          valor={inteiro.format(produzidos)}
          nota="Dados disponíveis no ODS Brasil"
          icone={Database}
        />
        <Resumo
          titulo="Em análise ou sem dados"
          valor={inteiro.format(pendentes)}
          nota="Indicadores ainda não produzidos"
          icone={AlertTriangle}
        />
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <FiltroLinha rotulo="Eixo">
            <button
              type="button"
              onClick={() => setEixo(null)}
              aria-pressed={eixo === null}
              className={cn(
                CHIP,
                eixo === null
                  ? "border-texto bg-texto text-fundo"
                  : "border-borda text-texto-2 hover:bg-superficie-2"
              )}
            >
              Todos
            </button>
            {EIXOS.map((item) => {
              const ativo = eixo === item.slug;
              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => alternarEixo(item.slug)}
                  aria-pressed={ativo}
                  className={cn(
                    CHIP,
                    ativo
                      ? "border-texto bg-texto text-fundo"
                      : "border-borda text-texto-2 hover:bg-superficie-2"
                  )}
                >
                  <span
                    className="size-2 rounded-sm"
                    style={{ background: corDoEixo(item.slug) }}
                    aria-hidden
                  />
                  Eixo {item.romano}
                </button>
              );
            })}
          </FiltroLinha>

          <FiltroLinha rotulo="Situação">
            <button
              type="button"
              onClick={() => setStatus(null)}
              aria-pressed={status === null}
              className={cn(
                CHIP,
                status === null
                  ? "border-texto bg-texto text-fundo"
                  : "border-borda text-texto-2 hover:bg-superficie-2"
              )}
            >
              Todas
            </button>
            {ORDEM_STATUS_ODS.map((valor) => {
              const ativo = status === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  onClick={() => alternarStatus(valor)}
                  aria-pressed={ativo}
                  className={cn(
                    CHIP,
                    ativo
                      ? "border-texto bg-texto text-fundo"
                      : "border-borda text-texto-2 hover:bg-superficie-2"
                  )}
                >
                  <span className={cn("size-2 rounded-full", COR_STATUS[valor])} />
                  {ROTULO_STATUS_ODS[valor]}
                </button>
              );
            })}
          </FiltroLinha>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-3"
              aria-hidden
            />
            <Entrada
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por ODS, código ou texto do indicador"
              aria-label="Buscar indicador ODS"
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-9">
        {DADOS_ODS.objetivos.map((objetivo) => {
          const ativo = objetivos.includes(objetivo.numero);
          const apagado = objetivos.length > 0 && !ativo;
          return (
            <button
              key={objetivo.numero}
              type="button"
              onClick={() => alternarNumero(objetivo.numero)}
              aria-pressed={ativo}
              aria-label={`ODS ${objetivo.numero}: ${objetivo.titulo}, ${objetivo.indicadores.length} indicadores mapeados`}
              className={cn(
                "relative aspect-square overflow-hidden rounded-card shadow-card transition-all focus-visible:ring-2 focus-visible:ring-lilas",
                apagado && "opacity-35 grayscale",
                ativo && "ring-4 ring-lilas ring-offset-2 ring-offset-fundo"
              )}
              title={`ODS ${objetivo.numero}: ${objetivo.titulo}`}
            >
              <Image
                src={LOGOS_ODS[objetivo.numero]}
                alt=""
                fill
                sizes="(min-width: 1280px) 11vw, (min-width: 640px) 16vw, 30vw"
                className="object-cover"
              />
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm sm:bottom-2 sm:right-2">
                {objetivo.indicadores.length}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-texto-3">
        Selecione um ou mais objetivos para exibir os indicadores relacionados.
        O número no canto de cada bloco indica quantos foram vinculados ao OSG.
      </p>

      {objetivos.length
        ? DADOS_ODS.objetivos.map((objetivo) => {
            const indicadores = porObjetivo.get(objetivo.numero);
            if (!indicadores?.length) return null;
            return (
              <section
                key={objetivo.numero}
                aria-labelledby={`ods-${objetivo.numero}`}
              >
                <header className="mb-3 flex items-center gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
                    style={{ background: objetivo.cor }}
                  >
                    {objetivo.numero}
                  </span>
                  <div>
                    <h3
                      id={`ods-${objetivo.numero}`}
                      className="font-semibold text-texto"
                    >
                      ODS {objetivo.numero} · {objetivo.titulo}
                    </h3>
                    <p className="text-xs text-texto-3">
                      {inteiro.format(indicadores.length)} indicadores no recorte
                    </p>
                  </div>
                </header>
                <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {indicadores.map((indicador) => (
                    <Indicador key={indicador.codigo} indicador={indicador} />
                  ))}
                </ul>
              </section>
            );
          })
        : null}

      {objetivos.length && !filtrados.length ? (
        <Card className="border-dashed p-8 text-center text-sm text-texto-3">
          Nenhum indicador corresponde aos filtros selecionados.
        </Card>
      ) : null}

      <footer className="rounded-card border border-borda bg-superficie-2/50 p-4 text-xs leading-relaxed text-texto-3">
        <p>
          <strong className="font-semibold text-texto-2">Critério do mapeamento.</strong>{" "}
          Todos os 14 indicadores do ODS 5 foram vinculados. Nos demais objetivos,
          o recorte parte dos indicadores sensíveis a gênero definidos pela ONU,
          incorpora atualizações nacionais e o ODS 18 e os relaciona aos seis
          eixos da Lei estadual nº 4.168/2023. Um indicador pode aparecer em mais
          de um eixo.
        </p>
        <p className="mt-2">
          Situação e redação consultadas em {formatarData(DADOS_ODS.consultadoEm)} no{" "}
          <a
            href={DADOS_ODS.fontes.brasil}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-lilas hover:underline"
          >
            portal ODS Brasil <ExternalLink className="inline size-3" aria-hidden />
          </a>
          . Referência de gênero: {" "}
          <a
            href={DADOS_ODS.fontes.onuGenero}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-lilas hover:underline"
          >
            quadro da Divisão de Estatística da ONU{" "}
            <ExternalLink className="inline size-3" aria-hidden />
          </a>
          .
        </p>
      </footer>
    </div>
  );
}

function Resumo({
  titulo,
  valor,
  nota,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  nota: string;
  icone: LucideIcon;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <Icone
        className="pointer-events-none absolute -bottom-4 -right-3 size-24 text-lilas opacity-15"
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="text-sm font-medium text-texto-3">{titulo}</p>
      <p className="tabular mt-2 text-2xl font-semibold text-texto">{valor}</p>
      <p className="mt-1.5 text-xs font-medium text-lilas">{nota}</p>
    </Card>
  );
}

function FiltroLinha({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-texto-3">{rotulo}:</span>
      {children}
    </div>
  );
}

function Indicador({ indicador }: { indicador: IndicadorOds }) {
  const temFicha = indicador.status === "produzido" && Boolean(indicador.url);
  return (
    <li>
      <Card className="h-full p-4">
        <div className="flex items-start justify-between gap-3">
          {temFicha ? (
            <a
              href={indicador.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-lilas hover:underline"
            >
              Indicador {indicador.codigo}
              <ExternalLink className="size-3.5 shrink-0" aria-hidden />
            </a>
          ) : (
            <span className="text-sm font-semibold text-texto-2">
              Indicador {indicador.codigo}
            </span>
          )}
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-superficie-2 px-2 py-1 text-[10px] font-medium text-texto-2">
            <span className={cn("size-2 rounded-full", COR_STATUS[indicador.status])} />
            {ROTULO_STATUS_ODS[indicador.status]}
          </span>
        </div>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-texto-2">
          {indicador.nome}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {indicador.eixos.map((slug) => {
            const eixo = EIXOS.find((item) => item.slug === slug);
            if (!eixo) return null;
            return (
              <span
                key={slug}
                className="inline-flex items-center gap-1.5 rounded-md border border-borda px-2 py-1 text-[10px] font-medium text-texto-3"
                title={eixo.nome}
              >
                <span
                  className="size-2 rounded-sm"
                  style={{ background: corDoEixo(slug) }}
                  aria-hidden
                />
                Eixo {eixo.romano} · {eixo.nome}
              </span>
            );
          })}
        </div>
      </Card>
    </li>
  );
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
