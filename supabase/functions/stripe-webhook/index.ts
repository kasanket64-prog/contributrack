import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const ts = Number(parts.t);
  const sigHex = parts.v1;
  if (!Number.isFinite(ts) || !sigHex) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${rawBody}`));
  const computed = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(computed.toLowerCase(), sigHex.toLowerCase());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const sigHeader = req.headers.get("Stripe-Signature") ?? "";
  const rawBody = await req.text();

  if (!webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Stripe webhook secrets not configured" }), { status: 500, headers: corsHeaders });
  }

  const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid Stripe signature" }), { status: 401, headers: corsHeaders });
  }

  const event = JSON.parse(rawBody) as {
    type: string;
    data: {
      object: {
        client_reference_id?: string;
        customer?: string;
        status?: string;
        metadata?: { workspace_id?: string; plan_tier?: string };
      };
    };
  };

  const admin = createClient(supabaseUrl, serviceKey);
  const obj = event.data?.object ?? {};
  const workspaceId = obj.metadata?.workspace_id ?? obj.client_reference_id;
  const planTier = obj.metadata?.plan_tier === "enterprise" ? "enterprise" : "pro";

  if (event.type === "checkout.session.completed" && workspaceId) {
    await admin
      .from("workspaces")
      .update({ plan_tier: planTier, stripe_customer_id: obj.customer ?? null })
      .eq("id", workspaceId);
  } else if (event.type === "customer.subscription.deleted" && obj.customer) {
    await admin
      .from("workspaces")
      .update({ plan_tier: "starter" })
      .eq("stripe_customer_id", obj.customer);
  } else if (event.type === "customer.subscription.updated" && obj.customer) {
    const active = obj.status === "active" || obj.status === "trialing";
    await admin
      .from("workspaces")
      .update({ plan_tier: active ? planTier : "starter" })
      .eq("stripe_customer_id", obj.customer);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
