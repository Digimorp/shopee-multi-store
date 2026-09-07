/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "exceljs", "pdfkit"],
  },
};

module.exports = nextConfig;
