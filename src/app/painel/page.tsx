import type { Metadata } from "next";
import { lerRegistros } from "@/lib/dados";
import { Painel } from "@/components/painel/painel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel interativo",
  description:
    "Filtre por exercício, eixo, categoria e órgão executor as dotações do Orçamento Sensível ao Gênero do Estado do Acre.",
};

export default async function PaginaPainel() {
  const { registros } = await lerRegistros();
  return <Painel registros={registros} />;
}
