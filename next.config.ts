import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xhklivswxbdulnioivci.supabase.co',
      },
    ],
  },
};

export default nextConfig;
