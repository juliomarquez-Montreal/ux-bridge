/** @type {import('next').NextConfig} */
const nextConfig = {
  // @resvg/resvg-js (export PDF do Bridge, lib/bridges/pdfExport.ts) embute
  // um binário nativo (.node) por plataforma — sem isso o webpack tenta
  // fazer parse do binário como JS e quebra o build.
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js"],
  },
};

module.exports = nextConfig;