// Fulanitas/Eventos and Delibocados run from the same source checkout,
// but must never overwrite one another's Next.js production build.
const isDelibocados =
  process.env.DELIBOCADOS_BUILD === "1" ||
  process.env.NEXT_PUBLIC_PANEL_INSTANCE === "delibocados";

// Blue/green release: the current QR preview runs from
// .next-delibocados-candidate. Build a NEW release without touching it.
const menuRelease=process.env.DELIBOCADOS_RELEASE_SLOT==="menu-v2";
const nextConfig = {
  distDir: menuRelease
    ? ".next-delibocados-menu-v2"
    : process.env.DELIBOCADOS_STAGING_BUILD === "1"
      ? ".next-delibocados-candidate"
      : isDelibocados ? ".next-delibocados" : ".next",
  // Route the existing printed QR URL to the isolated v2 storefront
  // BEFORE matching the legacy filesystem page, only in release menu-v2.
  async rewrites() {
    return {
      beforeFiles: menuRelease
        ? [{ source: "/qr-pedido", destination: "/qr-pedido-v2" }]
        : [],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
