/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static export — no server runtime, ideal for Vercel + lightweight.
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: true,
};

module.exports = nextConfig;
