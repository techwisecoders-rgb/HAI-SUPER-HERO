/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Ensure route handlers in Node runtime (needed for cookies + service role)
  experimental: {
    serverComponentsExternalPackages: ["@supabase/ssr", "@supabase/supabase-js"],
  },
};

export default nextConfig;
