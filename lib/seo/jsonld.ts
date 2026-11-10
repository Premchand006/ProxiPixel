/**
 * Schema.org JSON-LD builders. Only types with a real basis in what's on the
 * page: the site itself, each tool as a free WebApplication, and breadcrumbs.
 * (No FAQPage: Google no longer shows FAQ rich results, and the on-page Q&A is
 * there for readers, not for markup.)
 */
import {
  REPO_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
  siteUrl,
  type ConvertPair,
  type ToolPage,
  pairPath,
} from "./site";

type Json = Record<string, unknown>;

const WEBSITE_ID = () => `${siteUrl()}/#website`;
const ORG_ID = () => `${siteUrl()}/#organization`;

export function siteGraph(): Json {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID(),
        url: absoluteUrl("/"),
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": ORG_ID() },
      },
      {
        "@type": "Organization",
        "@id": ORG_ID(),
        name: SITE_NAME,
        url: absoluteUrl("/"),
        logo: absoluteUrl("/icon-512.png"),
        sameAs: [REPO_URL],
      },
    ],
  };
}

function webApplication(opts: {
  name: string;
  url: string;
  description: string;
  featureList: string[];
}): Json {
  return {
    "@type": "WebApplication",
    "@id": `${opts.url}#app`,
    name: opts.name,
    url: opts.url,
    description: opts.description,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements:
      "Requires JavaScript and WebAssembly. Works in current Chrome, Edge, Firefox and Safari.",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: opts.featureList,
    isPartOf: { "@id": WEBSITE_ID() },
    publisher: { "@id": ORG_ID() },
  };
}

function breadcrumbs(items: Array<{ name: string; path: string }>): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function toolGraph(tool: ToolPage): Json {
  const graph: Json[] = [
    webApplication({
      name: `${SITE_NAME} ${tool.name}`,
      url: absoluteUrl(tool.path),
      description: tool.description,
      featureList: tool.features,
    }),
  ];
  if (tool.path !== "/") {
    graph.push(
      breadcrumbs([
        { name: SITE_NAME, path: "/" },
        { name: tool.name, path: tool.path },
      ]),
    );
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export function pairGraph(p: ConvertPair): Json {
  const path = pairPath(p);
  return {
    "@context": "https://schema.org",
    "@graph": [
      webApplication({
        name: `${SITE_NAME} ${p.fromLabel} to ${p.toLabel} converter`,
        url: absoluteUrl(path),
        description: p.description,
        featureList: p.notes,
      }),
      breadcrumbs([
        { name: SITE_NAME, path: "/" },
        { name: `${p.fromLabel} to ${p.toLabel}`, path },
      ]),
    ],
  };
}

/** Serialize for a <script type="application/ld+json">, safe against `</script>`. */
export function serializeJsonLd(data: Json): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
