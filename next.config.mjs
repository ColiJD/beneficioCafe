// Node con el parche de seguridad del 21-10-2026 (Brotli RCE, TLS, DNS). En Vercel la rama sale de "engines"
// (24.x) y el parche lo pone Vercel; esto corre al compilar y detiene el build si la imagen aún no lo tiene.
const MINIMOS = { 22: [23, 4], 24: [22, 1], 26: [12, 1] };
const [mayor, menor, parche] = process.versions.node.split(".").map(Number);
const minimo = MINIMOS[mayor];
if (!minimo || menor < minimo[0] || (menor === minimo[0] && parche < minimo[1])) {
  throw new Error(
    `Node ${process.versions.node} no tiene el parche de seguridad del 21-10-2026. ` +
      "Use Node 22.23.4+, 24.22.1+ o 26.12.1+ (ver .nvmrc).",
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    allowedDevOrigins: [
      'http://192.168.1.6:3000', // tu PC local
      'http://localhost:3000',    // por si usas localhost
    ],
  },
};

export default nextConfig;
