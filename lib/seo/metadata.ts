import type { Metadata } from "next";
import { SITE_NAME, type ConvertPair, type ToolPage, pairPath } from "./site";

/** Metadata shared by every page that should be indexed. */
function pageMetadata(opts: {
  title: string;
  absoluteTitle?: boolean;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  const fullTitle = opts.absoluteTitle
    ? opts.title
    : `${opts.title} | ${SITE_NAME}`;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: { canonical: opts.path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: opts.path,
      title: fullTitle,
      description: opts.description,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: opts.description,
    },
  };
}

export function toolMetadata(tool: ToolPage): Metadata {
  const home = tool.path === "/";
  return pageMetadata({
    title: home ? `${SITE_NAME}: ${tool.title}` : tool.title,
    absoluteTitle: home,
    description: tool.description,
    path: tool.path,
    keywords: tool.keywords,
  });
}

export function pairMetadata(p: ConvertPair): Metadata {
  return pageMetadata({
    title: p.title,
    description: p.description,
    path: pairPath(p),
    keywords: [
      `${p.fromLabel} to ${p.toLabel}`.toLowerCase(),
      `convert ${p.fromLabel} to ${p.toLabel}`.toLowerCase(),
      `${p.fromLabel} to ${p.toLabel} converter`.toLowerCase(),
    ],
  });
}

/** For account, auth and share pages: reachable, but kept out of the index. */
export const NOINDEX: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

/** Full <title> text for a tool, as the browser tab shows it. */
export function documentTitle(tool: ToolPage): string {
  return tool.path === "/"
    ? `${SITE_NAME}: ${tool.title}`
    : `${tool.title} | ${SITE_NAME}`;
}
