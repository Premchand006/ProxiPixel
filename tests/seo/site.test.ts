import { describe, expect, it } from "vitest";
import {
  CONVERT_PAIRS,
  ROUTED_TOOLS,
  TOOL_LIST,
  absoluteUrl,
  pairBySlug,
  pairPath,
  toolBySlug,
} from "@/lib/seo/site";
import { documentTitle, pairMetadata, toolMetadata } from "@/lib/seo/metadata";
import {
  pairGraph,
  serializeJsonLd,
  siteGraph,
  toolGraph,
} from "@/lib/seo/jsonld";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { GET as llmsTxt } from "@/app/llms.txt/route";
import { OUT_CONVERT } from "@/lib/engine/encode";

const MAX_TITLE = 60;
const DESC = { min: 110, max: 160 };

const pages = [
  ...TOOL_LIST.map((t) => ({
    id: t.mode,
    path: t.path,
    title: documentTitle(t),
    description: t.description,
    h1: t.h1,
  })),
  ...CONVERT_PAIRS.map((p) => ({
    id: p.slug,
    path: pairPath(p),
    title: `${p.title} | ProxiPixel`,
    description: p.description,
    h1: p.h1,
  })),
];

describe("landing page copy", () => {
  it.each(pages)("$id: title fits in a SERP ($title)", ({ title }) => {
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE);
  });

  it.each(pages)(
    "$id: meta description is 110–160 chars",
    ({ description }) => {
      expect(description.length).toBeGreaterThanOrEqual(DESC.min);
      expect(description.length).toBeLessThanOrEqual(DESC.max);
    },
  );

  it("every path, title, description and H1 is unique", () => {
    for (const key of ["path", "title", "description", "h1"] as const) {
      const values = pages.map((p) => p[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("keeps the curated format pages under the 30-page quality gate", () => {
    expect(CONVERT_PAIRS.length).toBeLessThan(30);
  });

  it("each format page has its own notes and a real Convert output", () => {
    const outputs = new Set(OUT_CONVERT.map(([f]) => f));
    const allNotes = CONVERT_PAIRS.flatMap((p) => p.notes);
    expect(new Set(allNotes).size).toBe(allNotes.length);
    for (const p of CONVERT_PAIRS) {
      expect(p.notes.length).toBeGreaterThanOrEqual(3);
      expect(outputs.has(p.to)).toBe(true);
      expect(p.slug).toMatch(/^[a-z]+-to-[a-z]+$/);
    }
  });
});

describe("lookups", () => {
  it("resolves every routed tool and pair by slug", () => {
    for (const t of ROUTED_TOOLS) expect(toolBySlug(t.path.slice(1))).toBe(t);
    for (const p of CONVERT_PAIRS) expect(pairBySlug(p.slug)).toBe(p);
    expect(toolBySlug("library")).toBeUndefined();
    expect(pairBySlug("nope-to-nada")).toBeUndefined();
  });

  it("never routes a tool to a reserved app path", () => {
    const reserved = [
      "/library",
      "/presets",
      "/login",
      "/s",
      "/auth",
      "/convert",
    ];
    for (const t of ROUTED_TOOLS) expect(reserved).not.toContain(t.path);
  });
});

describe("metadata", () => {
  it("sets a canonical and social card for every page", () => {
    for (const t of TOOL_LIST) {
      const m = toolMetadata(t);
      expect(m.alternates?.canonical).toBe(t.path);
      expect(m.openGraph?.url).toBe(t.path);
      expect(m.twitter).toMatchObject({ card: "summary_large_image" });
    }
    const m = pairMetadata(CONVERT_PAIRS[0]!);
    expect(m.alternates?.canonical).toBe(pairPath(CONVERT_PAIRS[0]!));
  });

  it("uses an absolute title on the home page so the template isn't doubled", () => {
    const home = TOOL_LIST.find((t) => t.path === "/")!;
    expect(toolMetadata(home).title).toEqual({ absolute: documentTitle(home) });
  });
});

describe("structured data", () => {
  it("describes each tool as a free WebApplication", () => {
    for (const t of TOOL_LIST) {
      const graph = toolGraph(t)["@graph"] as Array<Record<string, unknown>>;
      const app = graph.find((n) => n["@type"] === "WebApplication")!;
      expect(app.url).toBe(absoluteUrl(t.path));
      expect(app.offers).toMatchObject({ price: "0" });
      const crumbs = graph.find((n) => n["@type"] === "BreadcrumbList");
      expect(Boolean(crumbs)).toBe(t.path !== "/");
    }
  });

  it("gives breadcrumbs unique item URLs", () => {
    const graph = pairGraph(CONVERT_PAIRS[0]!)["@graph"] as Array<
      Record<string, unknown>
    >;
    const crumbs = graph.find((n) => n["@type"] === "BreadcrumbList")!;
    const items = (crumbs.itemListElement as Array<{ item: string }>).map(
      (i) => i.item,
    );
    expect(new Set(items).size).toBe(items.length);
  });

  it("never emits FAQPage or HowTo markup", () => {
    const all = JSON.stringify([
      siteGraph(),
      ...TOOL_LIST.map(toolGraph),
      ...CONVERT_PAIRS.map(pairGraph),
    ]);
    expect(all).not.toContain("FAQPage");
    expect(all).not.toContain("HowTo");
  });

  it("escapes < so JSON-LD can't close its script tag", () => {
    const out = serializeJsonLd({ x: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual({
      x: "</script><script>alert(1)</script>",
    });
  });
});

describe("crawler files", () => {
  it("sitemap lists every landing page exactly once and no private pages", () => {
    const urls = sitemap().map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toHaveLength(TOOL_LIST.length + CONVERT_PAIRS.length);
    for (const p of pages) expect(urls).toContain(absoluteUrl(p.path));
    for (const priv of ["/library", "/presets", "/login", "/s/"]) {
      expect(urls.some((u) => u.includes(priv))).toBe(false);
    }
  });

  it("robots allows the site, points at the sitemap and blocks only /auth/", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    expect(rules[0]).toMatchObject({
      userAgent: "*",
      allow: "/",
      disallow: ["/auth/"],
    });
    expect(r.sitemap).toBe(absoluteUrl("/sitemap.xml"));
  });

  it("llms.txt links every landing page", async () => {
    const res = llmsTxt();
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body.startsWith("# ProxiPixel\n")).toBe(true);
    for (const p of pages) expect(body).toContain(`(${absoluteUrl(p.path)})`);
  });
});
