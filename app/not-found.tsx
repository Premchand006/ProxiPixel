import Link from "next/link";

export default function NotFound() {
  return (
    <main className="statewrap">
      <h1 className="pagetitle">Page not found</h1>
      <p className="pagesub" style={{ marginInline: "auto" }}>
        That page doesn’t exist.
      </p>
      <Link className="run sharedl" href="/">
        Back to the tools
      </Link>
    </main>
  );
}
