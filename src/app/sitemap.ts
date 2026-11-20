import type { MetadataRoute } from "next";
import { FEATURE_PAGES, POSTS, SITE_URL, UPDATED } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ["", "/features", "/pricing", "/about", "/contact", "/help", "/faq", "/blog", "/privacy", "/terms", "/login", "/signup"];
  return [
    ...staticPaths.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: new Date(UPDATED), changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.7 })),
    ...FEATURE_PAGES.map((p) => ({ url: `${SITE_URL}/${p.slug}`, lastModified: new Date(UPDATED), changeFrequency: "monthly" as const, priority: 0.8 })),
    ...POSTS.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: new Date(p.updated), changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
