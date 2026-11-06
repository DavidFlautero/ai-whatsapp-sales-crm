const nextConfig = {
  distDir: process.env.DELIBOCADOS_BUILD === "1"
    ? ".next-delibocados"
    : ".next",
};
export default nextConfig;
