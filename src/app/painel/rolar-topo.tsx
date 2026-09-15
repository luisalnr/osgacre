"use client";

import { useLayoutEffect } from "react";

/**
 * Leva a janela ao topo quando a tela de espera do painel monta.
 *
 * Quem clica em "Acessar painel interativo" na chamada do fim do site está com a
 * página rolada a uns 4.700 px. O esqueleto tem menos de 1.000 px de altura, e o
 * navegador só encosta a rolagem no máximo que cabe (~80 px) — ninguém a zera.
 * Quando os dados chegam a página cresce e a rolagem segue grudada no fim: o
 * painel abria mostrando os últimos gráficos, e não o topo. Medido em produção
 * (`next start`), com a View Transition ligada.
 *
 * `useLayoutEffect` para acontecer antes da pintura, e `behavior: "instant"`
 * para o salto não herdar o `scroll-behavior: smooth` do globals.css. Trocar o
 * estilo do <html> na hora não bastava: sem forçar um reflow, o Chromium ainda
 * animava a subida.
 */
export function RolarAoTopo() {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  return null;
}
