"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function AuthNav() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user);
        setReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  }

  if (!ready) return <span className="navauth" aria-hidden />;

  if (!user) {
    return (
      <Link href="/login" className="navlink navcta">
        Sign in
      </Link>
    );
  }

  const label = user.email ?? "Account";
  return (
    <div className="navauth">
      <span className="navemail" title={label}>
        {label}
      </span>
      <button className="navlink navsignout" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}
