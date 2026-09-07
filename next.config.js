/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "exceljs", "pdf-lib"],
  },
};

module.exports = nextConfig;
