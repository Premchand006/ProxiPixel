import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Studio } from "@/components/Studio";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolGraph } from "@/lib/seo/jsonld";
import { toolMetadata } from "@/lib/seo/metadata";
import { ROUTED_TOOLS, toolBySlug } from "@/lib/seo/site";

// One statically generated landing page per tool (/image-upscaler, /pdf-tools,
// ...). Anything else at this level is a 404 rather than a dynamic render.
export const dynamicParams = false;

export function generateStaticParams() {
  return ROUTED_TOOLS.map((t) => ({ tool: t.path.slice(1) }));
}

type Props = { params: Promise<{ tool: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = toolBySlug((await params).tool);
  return tool ? toolMetadata(tool) : {};
}

export default async function ToolLandingPage({ params }: Props) {
  const tool = toolBySlug((await params).tool);
  if (!tool) notFound();
  return (
    <>
      <JsonLd data={toolGraph(tool)} />
      <Studio initialMode={tool.mode} />
    </>
  );
}
