import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { encrypt, hashForLookup } from "@/lib/encryption";

async function syncProfile(user: { id: string; email?: string | null; user_metadata: Record<string, unknown> }) {
  const email = user.email ?? null;
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? null;

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
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectedFrom = searchParams.get("redirectedFrom");
  const next = redirectedFrom && redirectedFrom.startsWith("/") ? redirectedFrom : "/dashboard";

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
