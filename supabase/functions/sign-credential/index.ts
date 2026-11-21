import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function canonicalize(val: unknown): string {
  if (val === null || typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return `[${val.map(canonicalize).join(",")}]`;
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

async function signPayload(payload: Record<string, unknown>, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(canonicalize(payload)));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const signingSecret = Deno.env.get("CREDENTIAL_SIGNING_SECRET") || serviceKey;

  if (!supabaseUrl || !serviceKey || !signingSecret) {
    return new Response(JSON.stringify({ error: "Server signing environment not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Public verification lookup: GET ?credential_id=CT-2026-...
  if (req.method === "GET") {
    const url = new URL(req.url);
    const credentialId = url.searchParams.get("credential_id")?.trim() ?? "";
    if (!credentialId) {
      return new Response(JSON.stringify({ verified: false, error: "credential_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data, error } = await admin
      .from("contribution_certificates")
      .select("*")
      .eq("credential_id", credentialId)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ verified: false, reason: "Credential not found", certificate: null }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expected = await signPayload(data.payload as Record<string, unknown>, signingSecret);
    const verified = timingSafeEqual(expected, String(data.signature));
    return new Response(
      JSON.stringify({
        verified,
        reason: verified ? undefined : "HMAC-SHA256 signature mismatch",
        certificate: data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method === "POST") {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as {
      payload: Record<string, unknown>;
      workspace_id: string;
      workspace_name: string;
      member_id: string;
      member_name: string;
    };

    if (!body?.payload || !body.member_id || !body.workspace_id) {
      return new Response(JSON.stringify({ error: "Missing payload, member_id, or workspace_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signature = await signPayload(body.payload, signingSecret);
    const credentialId = `CT-2026-${signature.slice(0, 16)}`;
    const issuedAt = new Date().toISOString();

    const { data, error } = await admin
      .from("contribution_certificates")
      .upsert(
        {
          credential_id: credentialId,
          workspace_id: body.workspace_id,
          workspace_name: body.workspace_name,
          member_id: body.member_id,
          member_name: body.member_name,
          payload: body.payload,
          signature,
          algorithm: "HMAC-SHA256",
          issued_at: issuedAt,
        },
        { onConflict: "credential_id" },
      )
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        credential_id: credentialId,
        signature,
        algorithm: "HMAC-SHA256",
        issued_at: issuedAt,
        certificate: data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
