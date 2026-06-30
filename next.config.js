/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@neondatabase/serverless'],
    outputFileTracingIncludes: {
      '/api/merchants': ['./data/merchants.json'],
    },
  },
};

module.exports = nextConfig;
