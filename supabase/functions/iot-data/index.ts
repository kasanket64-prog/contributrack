import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type FaceExpression = "ENGAGED" | "FOCUSED" | "DISTRACTED" | "DROWSY" | "NEUTRAL" | "ABSENT";
type VoiceQuality = "PRODUCTIVE" | "NEUTRAL" | "OFF_TOPIC" | "DISRUPTIVE";
type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

interface VoiceAnalysis {
  voice_quality: VoiceQuality;
  voice_quality_score: number;
  voice_sentiment: Sentiment;
  detected_language: string;
  voice_topics: string[];
  voice_flags: string[];
  voice_summary: string;
}

// ── Engagement score: truth comes from BOTH what camera sees AND what mic hears ──
function computeEngagementScore(
  voice: number,
  face: number,
  faceExpr: FaceExpression,
  voiceQualityScore: number | null
): number {
  // No face detected at all
  if (face === 0 || faceExpr === "ABSENT") return 0;

  // Face detected — base score from expression
  const expressionBase: Record<FaceExpression, number> = {
    ENGAGED:    80,
    FOCUSED:    65,
    NEUTRAL:    50,
    DISTRACTED: 20,
    DROWSY:     8,
    ABSENT:     0,
  };

  let score = expressionBase[faceExpr];

  // Voice bonus/penalty
  if (voice === 1) {
    const vqs = voiceQualityScore ?? 60;
    // Good speech while engaged = maximum boost
    if (faceExpr === "ENGAGED") score = Math.min(100, score + Math.round(vqs * 0.25));
    // Speaking while distracted/drowsy = slightly higher — at least trying
    else score = Math.min(60, score + Math.round(vqs * 0.15));
  } else {
    // No voice — listening/reading is still valid engagement if face is engaged
    if (faceExpr === "ENGAGED") score = Math.max(60, score);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── Contribution level now truly reflects engagement quality ──
function computeContributionLevel(engagementScore: number, voice: number): { level: string; pct: number } {
  if (engagementScore >= 75) return { level: "HIGH", pct: engagementScore };
  if (engagementScore >= 40) return { level: "MEDIUM", pct: engagementScore };
  // Speaking but drowsy/distracted — presence doesn't count much
  if (voice === 1 && engagementScore < 20) return { level: "LOW", pct: Math.max(5, engagementScore) };
  return { level: "LOW", pct: Math.max(5, engagementScore) };
}

async function analyseVoice(
  transcript: string,
  memberName: string,
  sessionTitle: string | null,
  faceExpr: FaceExpression,
  client: Anthropic
): Promise<VoiceAnalysis> {
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

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response");

  const raw = textBlock.text.trim().replace(/^```json\s*/m, "").replace(/```\s*$/m, "");
  const parsed = JSON.parse(raw);

  return {
    voice_quality: parsed.voice_quality ?? "NEUTRAL",
    voice_quality_score: Math.max(0, Math.min(100, Math.round(parsed.voice_quality_score ?? 50))),
    voice_sentiment: parsed.voice_sentiment ?? "NEUTRAL",
    detected_language: parsed.detected_language ?? "en",
    voice_topics: Array.isArray(parsed.voice_topics) ? parsed.voice_topics.slice(0, 4) : [],
    voice_flags: Array.isArray(parsed.voice_flags) ? parsed.voice_flags.slice(0, 3) : [],
    voice_summary: parsed.voice_summary ?? "",
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
        voice = 0,
        face = 0,
        face_expression = "NEUTRAL",
        session,
        transcript,
      } = body;

      if (!device_id) {
        return new Response(JSON.stringify({ error: "device_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate face_expression
      const validExpressions: FaceExpression[] = ["ENGAGED", "FOCUSED", "DISTRACTED", "DROWSY", "NEUTRAL", "ABSENT"];
      const faceExpr: FaceExpression = validExpressions.includes(face_expression)
        ? face_expression
        : "NEUTRAL";

      // Lookup member
      const { data: member } = await supabase
        .from("members")
        .select("id, name")
        .eq("device_id", device_id)
        .maybeSingle();

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

      // Real-time voice analysis if transcript provided
      let voiceAnalysis: VoiceAnalysis = {
        voice_quality: "NEUTRAL",
        voice_quality_score: 50,
        voice_sentiment: "NEUTRAL",
        detected_language: "en",
        voice_topics: [],
        voice_flags: [],
        voice_summary: "",
      };

      const hasTranscript = typeof transcript === "string" && transcript.trim().length > 4;

      if (hasTranscript && Number(voice) === 1) {
        const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
        if (anthropicKey) {
          const claude = new Anthropic({ apiKey: anthropicKey });
          try {
            voiceAnalysis = await analyseVoice(
              transcript.trim(),
              member?.name ?? device_id,
              sessionTitle,
              faceExpr,
              claude
            );
          } catch {
            // Silent fallback
          }
        }
      }

      // Auto-flag problem states even without transcript
      if (faceExpr === "DROWSY" && !voiceAnalysis.voice_flags.includes("drowsy")) {
        voiceAnalysis.voice_flags = [...voiceAnalysis.voice_flags, "drowsy"].slice(0, 3);
      }
      if (faceExpr === "DISTRACTED" && !voiceAnalysis.voice_flags.includes("distracted")) {
        voiceAnalysis.voice_flags = [...voiceAnalysis.voice_flags, "distracted"].slice(0, 3);
      }
      // FOCUSED is a positive state — no flag, but note in summary if empty
      if (faceExpr === "FOCUSED" && !voiceAnalysis.voice_summary) {
        voiceAnalysis.voice_summary = "Member is focused on laptop work — silent but actively contributing.";
      }

      // Compute engagement score from both camera + voice
      const qualityScore = hasTranscript ? voiceAnalysis.voice_quality_score : null;
      const engagementScore = computeEngagementScore(Number(voice), Number(face), faceExpr, qualityScore);
      const { level, pct } = computeContributionLevel(engagementScore, Number(voice));

      // Determine active vs passive presence
      const isActivelyEngaged = engagementScore >= 50;
      const passivePresence = Number(face) === 1 && !isActivelyEngaged; // present but checked out

      const { data, error } = await supabase
        .from("iot_data")
        .insert({
          device_id,
          member_id: member?.id ?? null,
          voice: Number(voice),
          face: Number(face),
          face_expression: faceExpr,
          session_id: sessionId,
          contribution_level: level,
          contribution_pct: Math.max(0, Math.min(100, pct)),
          engagement_score: engagementScore,
          is_actively_engaged: isActivelyEngaged,
          passive_presence: passivePresence,
          transcript: hasTranscript ? transcript.trim() : null,
          voice_quality: voiceAnalysis.voice_quality,
          voice_quality_score: voiceAnalysis.voice_quality_score,
          voice_sentiment: voiceAnalysis.voice_sentiment,
          detected_language: voiceAnalysis.detected_language,
          voice_topics: voiceAnalysis.voice_topics,
          voice_flags: voiceAnalysis.voice_flags,
          voice_summary: voiceAnalysis.voice_summary || null,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          data,
          contribution_level: level,
          contribution_pct: pct,
          engagement_score: engagementScore,
          is_actively_engaged: isActivelyEngaged,
          passive_presence: passivePresence,
          face_expression: faceExpr,
          voice_analysis: hasTranscript ? voiceAnalysis : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
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
