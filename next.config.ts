import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "qrcode"],
  async redirects() {
    return [
      {
        source: "/admin/products",
        destination: "/v2/admin?tab=menu",
        permanent: false,
      },
      {
        source: "/admin/stock",
        destination: "/v2/admin?tab=stock",
        permanent: false,
      },
      {
        source: "/admin/bank",
        destination: "/v2/admin?tab=settings",
        permanent: false,
      },
      {
        source: "/admin/receipt",
        destination: "/v2/admin?tab=settings",
        permanent: false,
      },
      {
        source: "/admin",
        destination: "/v2/admin?tab=sales",
        permanent: false,
      },
      {
        source: "/v2/menu",
        destination: "/v2/admin?tab=menu",
        permanent: false,
      },
      {
        source: "/v2/stock",
        destination: "/v2/admin?tab=stock",
        permanent: false,
      },
      {
        source: "/v2/sales",
        destination: "/v2/admin?tab=sales",
        permanent: false,
      },
      {
        source: "/v2/settings",
        destination: "/v2/admin?tab=settings",
        permanent: false,
      },
      {
        source: "/v2/rates",
        destination: "/v2/admin?tab=rates",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
