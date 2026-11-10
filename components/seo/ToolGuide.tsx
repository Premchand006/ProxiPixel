import Link from "next/link";
import {
  CONVERT_PAIRS,
  pairPath,
  type ConvertPair,
  type ToolPage,
} from "@/lib/seo/site";

/**
 * Server-rendered explainer under each tool: how it works, what it does,
 * supported formats and common questions. Plain markup with no hooks, so the
 * Studio (a Client Component) can re-render it for whichever tab is active
 * while the initial HTML still carries the landing page's own content.
 */
export function ToolGuide({
  tool,
  pair,
}: {
  tool: ToolPage;
  pair?: ConvertPair;
}) {
  const headingName = pair ? `${pair.fromLabel} to ${pair.toLabel}` : tool.name;
  return (
    <section className="guide" aria-labelledby="guide-title">
      <h2 id="guide-title" className="guidetitle">
        {pair
          ? `What to know about converting ${pair.fromLabel} to ${pair.toLabel}`
          : `How the ${tool.name.toLowerCase()} works`}
      </h2>

      {pair && (
        <ul className="guidelist">
          {pair.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <div className="guidegrid">
        <div>
          <h3 className="guidehead">
            {pair ? `How to convert ${headingName}` : "Steps"}
          </h3>
          <ol className="guidelist">
            {(pair ? pairSteps(pair) : tool.steps).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="guidehead">Features</h3>
          <ul className="guidelist">
            {tool.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="guideformats">
            <b>Formats.</b> {tool.formats}
          </p>
        </div>
      </div>

      <h3 className="guidehead">Questions</h3>
      <div className="guideqa">
        {tool.questions.map((qa) => (
          <div key={qa.q}>
            <h4 className="guideq">{qa.q}</h4>
            <p className="guidea">{qa.a}</p>
          </div>
        ))}
      </div>

      {tool.mode === "convert" && <PairLinks current={pair?.slug} />}
    </section>
  );
}

function pairSteps(p: ConvertPair): string[] {
  return [
    `Drop, paste or pick your ${p.fromLabel} files. You can add as many as you like.`,
    `${p.toLabel} is already selected as the output format${
      p.to === "jpeg" || p.to === "webp"
        ? "; adjust the quality if you need smaller files"
        : ""
    }.`,
    `Press Convert, then download each ${p.toLabel} or all of them as a ZIP.`,
  ];
}

function PairLinks({ current }: { current?: string }) {
  const others = CONVERT_PAIRS.filter((p) => p.slug !== current);
  return (
    <>
      <h3 className="guidehead">Popular conversions</h3>
      <ul className="pairlinks">
        {current && (
          <li>
            <Link href="/">All image formats</Link>
          </li>
        )}
        {others.map((p) => (
          <li key={p.slug}>
            <Link href={pairPath(p)}>
              {p.fromLabel} to {p.toLabel}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
