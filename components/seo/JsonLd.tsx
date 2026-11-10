import { serializeJsonLd } from "@/lib/seo/jsonld";

/** Inline Schema.org JSON-LD. Not executed by the browser, so CSP-neutral. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
