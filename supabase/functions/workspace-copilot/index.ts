import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callLlmJson } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CopilotLlmResponse {
  answer: string;
  action_label?: string;
  action_page?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: corsHeaders });
  }

  const { question, workspace_id } = (await req.json()) as { question?: string; workspace_id?: string };
  if (!question?.trim()) {
    return new Response(JSON.stringify({ error: "question is required" }), { status: 400, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const wsFilter = (q: ReturnType<typeof admin.from>) =>
    workspace_id ? q.select("*").eq("workspace_id", workspace_id) : q.select("*");

  const [mRes, iRes, dRes, sRes, aRes] = await Promise.all([
    wsFilter(admin.from("members")),
    wsFilter(admin.from("iot_data")).order("created_at", { ascending: false }).limit(200),
    wsFilter(admin.from("documents")),
    wsFilter(admin.from("sessions")),
    wsFilter(admin.from("ai_insights")).is("session_id", null),
  ]);

  const members = mRes.data ?? [];
  const iot = iRes.data ?? [];
  const docs = dRes.data ?? [];
  const sessions = sRes.data ?? [];
  const insights = aRes.data ?? [];

  const summaryContext = {
    members: members.map((m) => ({
      name: m.name,
      role: m.role,
      insight: insights.find((a) => a.member_id === m.id) ?? null,
      readingsCount: iot.filter((r) => r.member_id === m.id).length,
      voiceTurns: iot.filter((r) => r.member_id === m.id && r.voice === 1).length,
      drowsyCount: iot.filter((r) => r.member_id === m.id && r.face_expression === "DROWSY").length,
      distractedCount: iot.filter((r) => r.member_id === m.id && r.face_expression === "DISTRACTED").length,
      words: docs.filter((d) => d.member_id === m.id).reduce((s, d) => s + Number(d.word_count ?? 0), 0),
    })),
    sessions: sessions.map((s) => ({ title: s.title, status: s.status })),
  };

  const prompt = `You are ContribuTrack AI Copilot. Answer the instructor or team lead's question concisely using ONLY the verified workspace telemetry below. Return JSON: { "answer": string, "action_label"?: string, "action_page"?: "dashboard"|"members"|"sessions"|"documents" }.

Workspace Data:
${JSON.stringify(summaryContext)}

Question: ${question}`;

  const llm = await callLlmJson<CopilotLlmResponse>(prompt);
  if (llm?.data?.answer) {
    return new Response(
      JSON.stringify({
        answer: llm.data.answer,
        provider: llm.provider,
        action: llm.data.action_label && llm.data.action_page
          ? { label: llm.data.action_label, page: llm.data.action_page }
          : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Deterministic server-side fallback if no LLM API key is set
  const lines = summaryContext.members.map(
    (m) => `• ${m.name}: Overall ${(m.insight as { overall_score?: number } | null)?.overall_score ?? 0}/100 · ${m.voiceTurns} voice turns · ${m.words.toLocaleString()} words`,
  );
  return new Response(
    JSON.stringify({
      answer: [`Workspace Telemetry Summary (${members.length} members, ${sessions.length} sessions):`, ...lines].join("\n"),
      provider: "rule-based",
      action: { label: "Open Dashboard", page: "dashboard" },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
