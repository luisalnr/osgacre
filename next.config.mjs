/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Liga o <ViewTransition> do React nas navegações do App Router: a troca do
    // site para o painel vira um esmaecimento cruzado em vez de um corte seco.
    // Ver o wrapper em `src/app/layout.tsx` e a duração em `globals.css`.
    viewTransition: true,
  },
};

export default nextConfig;
