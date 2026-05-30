/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  poweredByHeader: false,
  // Completely turn the indicator off
  devIndicators: false,

  // next/image runtime optimization is unavailable with `output: 'export'`.
  images: {
    unoptimized: true,
  },

  // Handle environment-specific logging and features
  onDemandEntries: {
    // Maximum time to keep idle entries in cache (in ms)
    maxInactiveAge: 60 * 60 * 1000,
    // Number of pages to keep in memory
    pagesBufferLength: 5,
  },
};

// Static Next.js configuration for optimized performance

export default nextConfig;
