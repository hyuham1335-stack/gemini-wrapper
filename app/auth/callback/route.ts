import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { encrypt, hashForLookup } from "@/lib/encryption";

async function syncProfile(user: { id: string; email?: string | null; user_metadata: Record<string, unknown> }) {
  const email = user.email ?? null;
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? null;

  // Profile sync is best-effort: a misconfigured encryption key or a write
  // failure must not block an otherwise successful login.
  try {
    const serviceClient = createServiceClient();
    const { error } = await serviceClient.from("profiles").upsert({
      user_id: user.id,
      email_encrypted: encrypt(email),
      email_hash: hashForLookup(email),
      full_name_encrypted: encrypt(fullName),
      full_name_hash: hashForLookup(fullName),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to sync profile after login", error);
    }
  } catch (error) {
    console.error("Failed to sync profile after login", error);
  }
}

const DEFAULT_REDIRECT = "/dashboard";

/**
 * Only same-origin paths are accepted. A leading `//` or `/\` is rejected too:
 * both are read as protocol-relative URLs by some clients, which would turn the
 * callback into an open redirect.
 */
function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/")) return DEFAULT_REDIRECT;
  if (value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_REDIRECT;
  return value;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("redirectedFrom"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await syncProfile(data.user);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
