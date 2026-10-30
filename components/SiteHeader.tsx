import Link from "next/link";
import Image from "next/image";
import { AuthNav } from "./auth/AuthNav";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Slim global nav rendered above every page. Brand + protected-area links +
 * a client-side session indicator. Kept a Server Component (only AuthNav is a
 * Client Component) so it doesn't force dynamic rendering of static pages.
 */
export function SiteHeader() {
  return (
    <nav className="sitenav" aria-label="Primary">
      <Link href="/" className="navbrand" aria-label="ProxiPixel home">
        <Image
          src="/logo.png"
          alt=""
          width={32}
          height={32}
          className="navlogo"
          priority
        />
      </Link>
      <div className="navspacer" />
      <Link href="/library" className="navlink">
        Library
      </Link>
      <Link href="/presets" className="navlink">
        Presets
      </Link>
      <AuthNav />
      <ThemeToggle />
    </nav>
  );
}
