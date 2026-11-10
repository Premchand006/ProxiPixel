import Link from "next/link";
import {
  CONVERT_PAIRS,
  REPO_URL,
  SITE_NAME,
  SITE_TAGLINE,
  TOOL_LIST,
  pairPath,
} from "@/lib/seo/site";

/**
 * Global footer. Besides orientation for people, it gives crawlers plain
 * <a href> links to every landing page: the in-app tool tabs are buttons, not
 * links, so without this the tool pages would only be discoverable via the
 * sitemap.
 */
export function SiteFooter() {
  return (
    <footer className="sitefooter">
      <div className="footcols">
        <nav aria-label="Tools" className="footcol">
          <h2 className="foothead">Tools</h2>
          <ul>
            {TOOL_LIST.map((t) => (
              <li key={t.mode}>
                <Link href={t.path}>{t.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Popular conversions" className="footcol">
          <h2 className="foothead">Popular conversions</h2>
          <ul className="footpairs">
            {CONVERT_PAIRS.map((p) => (
              <li key={p.slug}>
                <Link href={pairPath(p)}>
                  {p.fromLabel} to {p.toLabel}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="footcol">
          <h2 className="foothead">{SITE_NAME}</h2>
          <p className="footabout">
            {SITE_TAGLINE}. Your files are processed on your device and never
            uploaded.
          </p>
          <ul>
            <li>
              <a href={REPO_URL} rel="noopener">
                Source code on GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className="footbase">
        {SITE_NAME} · Image, video, document and PDF tools that run in your
        browser
      </p>
    </footer>
  );
}
