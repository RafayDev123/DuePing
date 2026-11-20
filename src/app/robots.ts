import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/portal/", "/api/", "/invite/", "/workspaces/", "/reset-password", "/verify-email"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
