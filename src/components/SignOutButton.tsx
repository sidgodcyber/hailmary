"use client";

import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";

export function SignOutButton() {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }
  return (
    <button
      onClick={signOut}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-muted hover:bg-black/5 hover:text-ink"
      aria-label="Sign out"
    >
      <Icon name="logout" size={18} />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
