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
