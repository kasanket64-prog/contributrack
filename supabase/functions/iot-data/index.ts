import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  VALID_EXPRESSIONS,
  buildIotRow,
  clampScore,
  heuristicVoiceAnalysis,
  type FaceExpression,
  type VoiceAnalysis,
} from "../_shared/scoring.ts";
import { callLlmJson } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Secret",
};

// Constant-time-ish string comparison so device secret checks don't leak
// timing information about how many leading characters matched.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function analyseVoice(
  transcript: string,
  memberName: string,
  sessionTitle: string | null,
  faceExpr: FaceExpression,
): Promise<{ analysis: VoiceAnalysis; engine: string }> {
  const faceContext = {
    ENGAGED:    "The camera shows the speaker is alert and making eye contact with the group.",
    FOCUSED:    "The camera shows the speaker is looking down at their laptop/notebook — they are working, not disengaged.",
    NEUTRAL:    "The camera shows the speaker's face with no strong expression signal.",
    DISTRACTED: "The camera shows the speaker appears distracted or looking away from work.",
    DROWSY:     "The camera shows the speaker appears drowsy or half-asleep.",
    ABSENT:     "The camera shows the speaker's face is not clearly visible.",
  }[faceExpr];

  const prompt = `You are an AI system monitoring real-time speech in a multilingual collaborative group session.

CRITICAL LANGUAGE RULE: The transcript may be in ANY language — Arabic, Urdu, Hindi, French, Spanish, Chinese, Turkish, Bengali, or any other. You MUST understand it regardless of language. ALL output fields (voice_summary, voice_topics, voice_flags) MUST be written in English. Translate concepts to English in your output.

Member speaking: ${memberName}
Session context: ${sessionTitle ?? "General collaborative workspace session"}
Camera observation: ${faceContext}

Transcript of what they just said (may be in any language):
"${transcript}"

Analyse this speech instantly and return ONLY a valid JSON object (no markdown, no explanation):

{
  "voice_quality": <"PRODUCTIVE" | "NEUTRAL" | "OFF_TOPIC" | "DISRUPTIVE">,
  "voice_quality_score": <integer 0-100>,
  "voice_sentiment": <"POSITIVE" | "NEUTRAL" | "NEGATIVE">,
  "detected_language": <ISO 639-1 code, e.g. "en", "ar", "ur", "hi", "fr", "zh">,
  "voice_topics": <array of 1-4 short topic strings IN ENGLISH>,
  "voice_flags": <array of 0-3 warning strings IN ENGLISH — empty [] if none, e.g. "off-topic", "filler-heavy", "negative tone", "disruptive", "drowsy speaker", "distracted speaker">,
  "voice_summary": <one crisp sentence IN ENGLISH — note if speaker seemed drowsy/distracted while talking>
}

Classification rules:
- PRODUCTIVE (70-100): actionable ideas, moves conversation forward, relevant knowledge, constructive critique
- NEUTRAL (40-69): brief acknowledgements, light on-topic filler, transitional statements
- OFF_TOPIC (15-39): unrelated topics, personal stories, jokes that derail
- DISRUPTIVE (0-14): arguing, insulting, deliberate derailment, dismissing teammates

Sentiment: POSITIVE=encouraging/collaborative, NEGATIVE=hostile/frustrated/dismissive, NEUTRAL=matter-of-fact
Note: if camera shows DROWSY or DISTRACTED, that context may lower the quality score slightly — their words matter but engagement signals the full picture.`;

  const llm = await callLlmJson<Partial<VoiceAnalysis>>(prompt, {
    anthropicModel: "claude-haiku-4-5",
    anthropicMaxTokens: 500,
  });

  if (llm) {
    const parsed = llm.data;
    const validQuality = ["PRODUCTIVE", "NEUTRAL", "OFF_TOPIC", "DISRUPTIVE"];
    const validSentiment = ["POSITIVE", "NEUTRAL", "NEGATIVE"];
    return {
      engine: llm.provider,
      analysis: {
        voice_quality: validQuality.includes(parsed.voice_quality ?? "") ? parsed.voice_quality! : "NEUTRAL",
        voice_quality_score: clampScore(parsed.voice_quality_score ?? 50),
        voice_sentiment: validSentiment.includes(parsed.voice_sentiment ?? "") ? parsed.voice_sentiment! : "NEUTRAL",
        detected_language: typeof parsed.detected_language === "string" && parsed.detected_language ? parsed.detected_language : "en",
        voice_topics: Array.isArray(parsed.voice_topics) ? parsed.voice_topics.map(String).slice(0, 4) : [],
        voice_flags: Array.isArray(parsed.voice_flags) ? parsed.voice_flags.map(String).slice(0, 3) : [],
        voice_summary: typeof parsed.voice_summary === "string" ? parsed.voice_summary : "",
      },
    };
  }

  return {
    engine: "rule-based",
    analysis: heuristicVoiceAnalysis(transcript, faceExpr),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (req.method === "POST") {
      const body = await req.json();
      const {
        device_id,
        device_secret,
        voice = 0,
        face = 0,
        face_expression = "NEUTRAL",
        session,
        transcript,
      } = body;

      // A device secret can also be supplied as a header, for devices that
      // can't easily template JSON bodies.
      const headerSecret = req.headers.get("X-Device-Secret");
      const providedSecret = typeof device_secret === "string" ? device_secret : headerSecret;

      if (!device_id) {
        return new Response(JSON.stringify({ error: "device_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const faceNum = Number(face) === 1 ? 1 : 0;
      const voiceNum = Number(voice) === 1 ? 1 : 0;
      const faceExpr: FaceExpression = VALID_EXPRESSIONS.includes(face_expression)
        ? face_expression
        : faceNum ? "NEUTRAL" : "ABSENT";

      // Lookup member
      const { data: member } = await supabase
        .from("members")
        .select("id, name, device_secret")
        .eq("device_id", device_id)
        .maybeSingle();

      // ── Device authentication ────────────────────────────────────────
      if (!member) {
        return new Response(JSON.stringify({ error: "Unknown device_id" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!providedSecret || !timingSafeEqual(providedSecret, member.device_secret ?? "")) {
        return new Response(JSON.stringify({ error: "Invalid or missing device_secret" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Lookup session
      let sessionId: string | null = null;
      let sessionTitle: string | null = null;
      if (session) {
        const { data: sessionRow } = await supabase
          .from("sessions")
          .select("id, title")
          .eq("id", session)
          .maybeSingle();
        sessionId = sessionRow?.id ?? null;
        sessionTitle = sessionRow?.title ?? null;
      }

      const hasTranscript = typeof transcript === "string" && transcript.trim().length > 4;
      let voiceAnalysis: VoiceAnalysis | null = null;
      let analysisEngine = "none";

      if (hasTranscript && voiceNum === 1) {
        const res = await analyseVoice(
          transcript.trim(),
          member?.name ?? device_id,
          sessionTitle,
          faceExpr,
        );
        voiceAnalysis = res.analysis;
        analysisEngine = res.engine;
      }

      const built = buildIotRow(
        {
          device_id,
          voice: voiceNum,
          face: faceNum,
          face_expression: faceExpr,
          transcript: hasTranscript ? transcript.trim() : null,
        },
        voiceAnalysis,
      );

      const { data, error } = await supabase
        .from("iot_data")
        .insert({
          ...built.row,
          member_id: member.id,
          session_id: sessionId,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          data,
          contribution_level: built.row.contribution_level,
          contribution_pct: built.row.contribution_pct,
          engagement_score: built.row.engagement_score,
          is_actively_engaged: built.row.is_actively_engaged,
          passive_presence: built.row.passive_presence,
          face_expression: built.faceExpr,
          voice_analysis: built.hasTranscript ? built.voiceAnalysis : null,
          analysis_engine: analysisEngine,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") ?? "50");
      const deviceId = url.searchParams.get("device_id");

      let query = supabase
        .from("iot_data")
        .select("*, members(name, email)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (deviceId) query = query.eq("device_id", deviceId);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
