/** Trigger a browser download for a URL with a given filename. */
export function trigger(url: string, name: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** Save each finished result individually, spaced out so browsers don't block. */
export async function downloadEach(
  results: Array<{ url: string; name: string }>,
): Promise<void> {
  for (const r of results) {
    trigger(r.url, r.name);
    await sleep(250);
  }
}
