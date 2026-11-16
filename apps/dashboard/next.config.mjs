// Fulanitas/Eventos and Delibocados run from the same source checkout,
// but must never overwrite one another's Next.js production build.
const isDelibocados =
  process.env.DELIBOCADOS_BUILD === "1" ||
  process.env.NEXT_PUBLIC_PANEL_INSTANCE === "delibocados";

const nextConfig = {
  distDir: process.env.DELIBOCADOS_STAGING_BUILD === "1"
    ? ".next-delibocados-candidate"
    : isDelibocados ? ".next-delibocados" : ".next",
};

export default nextConfig;
