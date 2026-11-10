import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og";
import { ROUTED_TOOLS, SITE_NAME, toolBySlug } from "@/lib/seo/site";

export const alt = `${SITE_NAME} tool preview`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return ROUTED_TOOLS.map((t) => ({ tool: t.path.slice(1) }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const tool = toolBySlug((await params).tool) ?? ROUTED_TOOLS[0]!;
  return renderOgImage({
    eyebrow: tool.name,
    title: tool.h1,
    subtitle: tool.lead,
  });
}
