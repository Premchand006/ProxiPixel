import type { Metadata } from "next";
import { Studio } from "@/components/Studio";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolGraph } from "@/lib/seo/jsonld";
import { toolMetadata } from "@/lib/seo/metadata";
import { TOOLS } from "@/lib/seo/site";

export const metadata: Metadata = toolMetadata(TOOLS.convert);

export default function Home() {
  return (
    <>
      <JsonLd data={toolGraph(TOOLS.convert)} />
      <Studio initialMode="convert" />
    </>
  );
}
