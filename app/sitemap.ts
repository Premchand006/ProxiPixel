import type { MetadataRoute } from "next";
import {
  CONVERT_PAIRS,
  TOOL_LIST,
  absoluteUrl,
  pairPath,
} from "@/lib/seo/site";

/**
 * Every indexable URL: the home page (Convert), one landing page per tool and
 * the curated format pages. Private pages (library, presets, login, shares)
 * are noindex and deliberately left out. No lastmod: the pages are static and
 * a fake build-time date would only teach crawlers to ignore it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...TOOL_LIST.map((t) => ({
      url: absoluteUrl(t.path),
      changeFrequency: "monthly" as const,
      priority: t.path === "/" ? 1 : 0.8,
    })),
    ...CONVERT_PAIRS.map((p) => ({
      url: absoluteUrl(pairPath(p)),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
