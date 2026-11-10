import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/metadata";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: NOINDEX };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError =
    error === "auth" ? "Could not sign you in. Please try again." : "";

  return (
    <main className="authwrap">
      <LoginForm initialError={initialError} />
    </main>
  );
}
