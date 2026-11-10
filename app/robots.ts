import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Everything public is crawlable, AI search crawlers included (the tools
 * are free and the pages describe them; there's nothing to protect).
 * Account and share pages stay crawlable on purpose so crawlers can see their
 * `noindex`; only the OAuth callback, which has no content, is disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/auth/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
