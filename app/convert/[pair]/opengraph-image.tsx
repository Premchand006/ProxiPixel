import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og";
import { CONVERT_PAIRS, SITE_NAME, pairBySlug } from "@/lib/seo/site";

export const alt = `${SITE_NAME} format converter preview`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return CONVERT_PAIRS.map((p) => ({ pair: p.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ pair: string }>;
}) {
  const p = pairBySlug((await params).pair) ?? CONVERT_PAIRS[0]!;
  return renderOgImage({
    eyebrow: `${p.fromLabel} → ${p.toLabel}`,
    title: p.h1,
    subtitle: p.lead,
  });
}
