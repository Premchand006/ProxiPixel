import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og";
import { TOOLS } from "@/lib/seo/site";

export const alt =
  "ProxiPixel: private image, video, document and PDF tools in your browser";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Image · Video · Documents · PDF",
    title: "Media tools that never upload your files",
    subtitle: TOOLS.convert.lead,
  });
}
