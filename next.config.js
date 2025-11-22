/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  
  // Image optimization
  images: {
    domains: ['bpfmvtjlabaujmlwegxc.supabase.co'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Exclude directories from webpack compilation
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    }
    return config
  },
  
  // Exclude non-Next.js directories from page routing
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
}

module.exports = nextConfig
