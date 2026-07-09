import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const securityHeaders = [
  // Force HTTPS for two years, including subdomains
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Block the app from being embedded in iframes (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Don't let browsers MIME-sniff responses
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send the origin as referrer cross-site
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation is needed for GPS clock in/out; everything else off
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  turbopack: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
