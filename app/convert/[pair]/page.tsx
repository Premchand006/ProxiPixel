import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Studio } from "@/components/Studio";
import { JsonLd } from "@/components/seo/JsonLd";
import { pairGraph } from "@/lib/seo/jsonld";
import { pairMetadata } from "@/lib/seo/metadata";
import { CONVERT_PAIRS, pairBySlug } from "@/lib/seo/site";

// Curated format pages (/convert/heic-to-jpg, ...): the Convert tool with the
// output format preselected, plus notes specific to that pair.
export const dynamicParams = false;

export function generateStaticParams() {
  return CONVERT_PAIRS.map((p) => ({ pair: p.slug }));
}

type Props = { params: Promise<{ pair: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = pairBySlug((await params).pair);
  return p ? pairMetadata(p) : {};
}

export default async function ConvertPairPage({ params }: Props) {
  const p = pairBySlug((await params).pair);
  if (!p) notFound();
  return (
    <>
      <JsonLd data={pairGraph(p)} />
      <Studio initialMode="convert" pairSlug={p.slug} />
    </>
  );
}
