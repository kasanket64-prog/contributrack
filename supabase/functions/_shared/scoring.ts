// Pure, dependency-free scoring logic shared by:
//   - the Supabase edge functions (iot-data, analyze-contribution), and
//   - the browser "local demo mode" backend (src/lib/localBackend.ts).
// Keep this file free of Deno / Node / browser specific APIs.

export type FaceExpression = "ENGAGED" | "FOCUSED" | "DISTRACTED" | "DROWSY" | "NEUTRAL" | "ABSENT";
export type VoiceQuality = "PRODUCTIVE" | "NEUTRAL" | "OFF_TOPIC" | "DISRUPTIVE";
export type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export const VALID_EXPRESSIONS: FaceExpression[] = ["ENGAGED", "FOCUSED", "DISTRACTED", "DROWSY", "NEUTRAL", "ABSENT"];

export interface VoiceAnalysis {
  voice_quality: VoiceQuality;
  voice_quality_score: number;
  voice_sentiment: Sentiment;
  detected_language: string;
  voice_topics: string[];
  voice_flags: string[];
  voice_summary: string;
}

export const DEFAULT_VOICE_ANALYSIS: VoiceAnalysis = {
  voice_quality: "NEUTRAL",
  voice_quality_score: 50,
  voice_sentiment: "NEUTRAL",
  detected_language: "en",
  voice_topics: [],
  voice_flags: [],
  voice_summary: "",
};

export function clampScore(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ── Engagement score: truth comes from BOTH what camera sees AND what mic hears ──
export function computeEngagementScore(
  voice: number,
  face: number,
  faceExpr: FaceExpression,
  voiceQualityScore: number | null,
): number {
  if (face === 0 || faceExpr === "ABSENT") return 0;
  const expressionBase: Record<FaceExpression, number> = {
    ENGAGED: 80, FOCUSED: 65, NEUTRAL: 50, DISTRACTED: 20, DROWSY: 8, ABSENT: 0,
  };
  let score = expressionBase[faceExpr];
  if (voice === 1) {
    const vqs = voiceQualityScore ?? 60;
    if (faceExpr === "ENGAGED") score = Math.min(100, score + Math.round(vqs * 0.25));
    else score = Math.min(60, score + Math.round(vqs * 0.15));
  } else if (faceExpr === "ENGAGED") {
    score = Math.max(60, score);
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeContributionLevel(engagementScore: number): { level: "HIGH" | "MEDIUM" | "LOW"; pct: number } {
  if (engagementScore >= 75) return { level: "HIGH", pct: engagementScore };
  if (engagementScore >= 40) return { level: "MEDIUM", pct: engagementScore };
  return { level: "LOW", pct: Math.max(5, engagementScore) };
}

// ── Heuristic (no-API-key) voice analysis ──────────────────────────────────
const PRODUCTIVE_WORDS = [
  "should", "could", "propose", "idea", "plan", "next", "deadline", "task", "implement", "design", "fix",
  "test", "because", "solution", "agree", "suggest", "let's", "lets", "data", "result", "analysis", "draft",
  "review", "section", "slide", "report", "code", "feature", "issue", "approach", "research", "finish",
];
const OFF_TOPIC_WORDS = [
  "movie", "game", "netflix", "party", "weekend", "lunch", "dinner", "instagram", "tiktok", "football",
  "cricket", "match", "song", "youtube", "vacation", "holiday", "gossip", "meme",
];
const DISRUPTIVE_WORDS = [
  "stupid", "shut up", "idiot", "useless", "whatever", "don't care", "dont care", "boring", "dumb", "hate",
];
const POSITIVE_WORDS = ["great", "good", "nice", "thanks", "thank you", "awesome", "agree", "love", "well done", "excellent", "yes"];
const NEGATIVE_WORDS = ["bad", "wrong", "hate", "annoying", "terrible", "no way", "angry", "frustrated", "stupid", "useless"];
const FILLERS = ["um", "uh", "like", "you know", "basically", "literally", "hmm"];
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with", "is", "are", "was", "were", "be",
  "this", "that", "it", "we", "i", "you", "they", "he", "she", "so", "do", "did", "can", "should", "could",
  "will", "would", "just", "have", "has", "our", "my", "your", "at", "as", "if", "then", "there", "what",
  "about", "maybe", "also", "need", "lets", "let's", "think", "yeah", "okay", "ok",
]);

function countMatches(text: string, words: string[]): number {
  let n = 0;
  for (const w of words) {
    const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "g");
    n += (text.match(re) ?? []).length;
  }
  return n;
}

export function heuristicVoiceAnalysis(transcript: string, faceExpr: FaceExpression): VoiceAnalysis {
  const text = transcript.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const productive = countMatches(text, PRODUCTIVE_WORDS);
  const offTopic = countMatches(text, OFF_TOPIC_WORDS);
  const disruptive = countMatches(text, DISRUPTIVE_WORDS);
  const positive = countMatches(text, POSITIVE_WORDS);
  const negative = countMatches(text, NEGATIVE_WORDS);
  const fillers = countMatches(text, FILLERS);

  let quality: VoiceQuality = "NEUTRAL";
  let score = 50 + Math.min(20, words.length);
  if (disruptive > 0) { quality = "DISRUPTIVE"; score = 8; }
  else if (offTopic > productive) { quality = "OFF_TOPIC"; score = 28; }
  else if (productive >= 2 || (productive >= 1 && words.length >= 8)) { quality = "PRODUCTIVE"; score = Math.min(95, 68 + productive * 5 + Math.min(10, words.length / 3)); }
  else if (words.length < 4) { score = 45; }
  if (quality !== "DISRUPTIVE" && words.length > 0 && fillers / words.length > 0.2) score -= 10;
  if (faceExpr === "DROWSY" || faceExpr === "DISTRACTED") score -= 8;
  score = clampScore(score);

  const sentiment: Sentiment = negative > positive ? "NEGATIVE" : positive > negative ? "POSITIVE" : "NEUTRAL";

  const freq: Record<string, number> = {};
  for (const w of words.map((w) => w.replace(/[^a-z0-9'-]/g, ""))) {
    if (w.length < 4 || STOPWORDS.has(w)) continue;
    freq[w] = (freq[w] ?? 0) + 1;
  }
  const topics = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);

  const flags: string[] = [];
  if (quality === "OFF_TOPIC") flags.push("off-topic");
  if (quality === "DISRUPTIVE") flags.push("disruptive");
  if (sentiment === "NEGATIVE") flags.push("negative tone");
  if (words.length > 0 && fillers / words.length > 0.2) flags.push("filler-heavy");
  if (faceExpr === "DROWSY") flags.push("drowsy speaker");
  if (faceExpr === "DISTRACTED") flags.push("distracted speaker");

  // Non-latin script → can't reliably classify; report language guess only.
  const nonLatin = [...transcript].some((ch) => (ch.codePointAt(0) ?? 0) > 0x024F);
  const summaryBase = {
    PRODUCTIVE: "Made a constructive, on-topic contribution",
    NEUTRAL: "Made a brief or neutral remark",
    OFF_TOPIC: "Spoke about something unrelated to the task",
    DISRUPTIVE: "Made a dismissive or disruptive remark",
  }[quality];

  return {
    voice_quality: quality,
    voice_quality_score: score,
    voice_sentiment: sentiment,
    detected_language: nonLatin ? "unknown" : "en",
    voice_topics: topics,
    voice_flags: flags.slice(0, 3),
    voice_summary: `${summaryBase}${topics.length ? ` (topics: ${topics.join(", ")})` : ""}${faceExpr === "DROWSY" ? " while appearing drowsy" : faceExpr === "DISTRACTED" ? " while appearing distracted" : ""}.`,
  };
}

// ── Per-member contribution analysis ───────────────────────────────────────
export interface ReadingInput {
  voice: number;
  face: number;
  face_expression: string | null;
  engagement_score: number | null;
  is_actively_engaged: boolean | null;
  passive_presence: boolean | null;
  contribution_level: string;
  created_at: string;
  session_id: string | null;
  transcript: string | null;
  voice_quality: string | null;
  voice_quality_score: number | null;
  voice_sentiment?: string | null;
  voice_topics?: string[] | null;
  voice_flags?: string[] | null;
  voice_summary?: string | null;
}

export interface SessionInput {
  id: string;
  title?: string;
  status?: string;
  started_at: string;
  ended_at: string | null;
}

export interface DocInput {
  word_count: number;
  char_count?: number;
  name?: string;
}

export interface MemberInput {
  id: string;
  name: string;
  role: string;
  readings: ReadingInput[];
  docs: DocInput[];
}

export interface ContributionAnalysis {
  overall_score: number;
  engagement_level: "HIGH" | "MEDIUM" | "LOW";
  voice_score: number;
  presence_score: number;
  writing_score: number;
  consistency_score: number;
  active_time_score: number;
  voice_content_score: number;
  narrative: string;
  strengths: string[];
  improvements: string[];
  contribution_pct: number;
}

export const READING_INTERVAL_SECONDS = 30;

export function sessionDurationMinutes(session: SessionInput): number {
  const start = new Date(session.started_at).getTime();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / 60000));
}

export function activeTimeMinutes(readings: ReadingInput[]): number {
  const n = readings.filter((r) => r.is_actively_engaged === true || r.voice === 1).length;
  return Math.round((n * READING_INTERVAL_SECONDS) / 60);
}

export function passiveTimeMinutes(readings: ReadingInput[]): number {
  return Math.round((readings.filter((r) => r.passive_presence === true).length * READING_INTERVAL_SECONDS) / 60);
}

export function memberSessionMinutes(readings: ReadingInput[], sessions: SessionInput[]): number {
  const ids = new Set(readings.map((r) => r.session_id).filter(Boolean));
  const fromSessions = sessions.filter((s) => ids.has(s.id)).reduce((s, sess) => s + sessionDurationMinutes(sess), 0);
  // Readings without a session still represent tracked time.
  const unsessioned = Math.round((readings.filter((r) => !r.session_id).length * READING_INTERVAL_SECONDS) / 60);
  return fromSessions + unsessioned;
}

/**
 * Deterministic rule-based analysis. Mirrors the scoring guidance given to the
 * LLM so results are comparable whether or not an AI key is configured.
 */
export function ruleBasedAnalysis(member: MemberInput, allMembers: MemberInput[]): ContributionAnalysis {
  const r = member.readings;
  const n = r.length;
  const pct = (k: number) => (n > 0 ? (k / n) * 100 : 0);

  const voicePct = pct(r.filter((x) => x.voice === 1).length);
  const facePct = pct(r.filter((x) => x.face === 1).length);
  const count = (e: string) => r.filter((x) => x.face_expression === e).length;
  const toMin = (c: number) => (c * READING_INTERVAL_SECONDS) / 60;
  const drowsyMin = toMin(count("DROWSY"));
  const distractedMin = toMin(count("DISTRACTED"));
  const activeMin = activeTimeMinutes(r);
  const trackedMin = Math.max(toMin(n), 1);

  const withT = r.filter((x) => x.transcript && x.voice_quality);
  const qualityValue: Record<string, number> = { PRODUCTIVE: 100, NEUTRAL: 55, OFF_TOPIC: 20, DISRUPTIVE: 0 };
  const voiceContent = withT.length ? withT.reduce((s, x) => s + (qualityValue[x.voice_quality ?? "NEUTRAL"] ?? 55), 0) / withT.length : 0;
  const avgVq = withT.length ? withT.reduce((s, x) => s + (x.voice_quality_score ?? 50), 0) / withT.length : null;

  const voiceScore = avgVq !== null ? voicePct * 0.4 + avgVq * 0.6 : Math.min(100, voicePct * 0.6 + (voicePct > 0 ? 20 : 0));
  const presenceScore = facePct - (drowsyMin / trackedMin) * 80 - (distractedMin / trackedMin) * 40;
  // Active time is measured against the time this member was actually tracked.
  const activeTimeScore = (activeMin / trackedMin) * 100;

  const words = member.docs.reduce((s, d) => s + (d.word_count ?? 0), 0);
  const groupAvgWords = allMembers.length
    ? allMembers.reduce((s, m) => s + m.docs.reduce((a, d) => a + (d.word_count ?? 0), 0), 0) / allMembers.length
    : 0;
  const writingScore = words === 0 ? 0 : groupAvgWords <= 0 ? 60 : words <= groupAvgWords ? (words / groupAvgWords) * 60 : 60 + Math.min(40, ((words - groupAvgWords) / groupAvgWords) * 40);

  // Consistency: low variance of engagement + penalties for problem states.
  const eng = r.map((x) => x.engagement_score ?? 0);
  const mean = eng.length ? eng.reduce((a, b) => a + b, 0) / eng.length : 0;
  const sd = eng.length ? Math.sqrt(eng.reduce((a, b) => a + (b - mean) ** 2, 0) / eng.length) : 0;
  let consistency = n === 0 ? 0 : 100 - sd * 1.2 - pct(count("DROWSY")) * 0.8 - pct(count("DISTRACTED")) * 0.4;
  if (n > 0 && n < 4) consistency = Math.min(consistency, 60);

  const overall =
    voiceScore * 0.18 + voiceContent * 0.12 + Math.max(0, presenceScore) * 0.2 + activeTimeScore * 0.2 + writingScore * 0.15 + Math.max(0, consistency) * 0.15;
  const overallScore = clampScore(withT.length ? overall : overall / 0.88); // re-weight when no transcripts exist
  const level: "HIGH" | "MEDIUM" | "LOW" = overallScore >= 70 ? "HIGH" : overallScore >= 40 ? "MEDIUM" : "LOW";

  // Contribution share relative to the group (weighted by engagement quality).
  const rawWeight = (m: MemberInput) => {
    const a = activeTimeMinutes(m.readings);
    const e = m.readings.length ? m.readings.reduce((s, x) => s + (x.engagement_score ?? 0), 0) / m.readings.length : 0;
    const w = m.docs.reduce((s, d) => s + (d.word_count ?? 0), 0);
    return a * (0.5 + e / 200) + w / 100 + m.readings.length * 0.05;
  };
  const totalWeight = allMembers.reduce((s, m) => s + rawWeight(m), 0);
  const contributionPct = totalWeight > 0 ? clampScore((rawWeight(member) / totalWeight) * 100) : 0;

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (voicePct >= 40) strengths.push(`Spoke actively in ${Math.round(voicePct)}% of sensor readings`);
  if (voiceContent >= 70) strengths.push("Spoken contributions were mostly productive and on-topic");
  if (presenceScore >= 70) strengths.push("Consistently present and attentive on camera");
  if (count("FOCUSED") >= Math.max(2, n * 0.3)) strengths.push("Spent significant time focused on hands-on work");
  if (writingScore >= 60) strengths.push(`Strong written contribution (${words.toLocaleString()} words)`);
  if (consistency >= 70 && n >= 4) strengths.push("Steady, consistent engagement across the session");
  if (strengths.length === 0) strengths.push(n > 0 ? "Participated in tracked sessions" : "Registered and ready to be tracked");

  if (drowsyMin > 5) improvements.push("Stay alert and avoid drowsiness");
  if (distractedMin > 10) improvements.push("Reduce distraction during sessions");
  if (voicePct < 25 && n > 0) improvements.push("Speak up more often during discussions");
  if (withT.length && voiceContent < 50) improvements.push("Keep spoken contributions focused on the task");
  if (writingScore < 40) improvements.push("Contribute more to written documents");
  if (n === 0) improvements.push("Link an IoT device so participation can be measured");
  if (improvements.length < 2) improvements.push("Keep up the current level of involvement");

  const firstName = member.name.split(" ")[0];
  const narrative = n === 0 && words === 0
    ? `${member.name} has no sensor readings or documents yet, so no contribution can be measured. Pair a device on the Members page and start a session to begin tracking.`
    : [
        `${firstName} was tracked across ${n} sensor reading${n === 1 ? "" : "s"} and was genuinely active for about ${activeMin} minute${activeMin === 1 ? "" : "s"}.`,
        `They were visible on camera ${Math.round(facePct)}% of the time and speaking in ${Math.round(voicePct)}% of readings${drowsyMin > 0 ? `, but appeared drowsy for roughly ${Math.round(drowsyMin)} minutes` : ""}${distractedMin > 0 ? `${drowsyMin > 0 ? " and" : ", but"} distracted for about ${Math.round(distractedMin)} minutes` : ""}.`,
        withT.length ? `Of ${withT.length} analysed spoken remarks, the average content quality was ${Math.round(voiceContent)}/100.` : "",
        `Written work: ${member.docs.length} document${member.docs.length === 1 ? "" : "s"} totalling ${words.toLocaleString()} words${groupAvgWords > 0 ? ` (group average ${Math.round(groupAvgWords).toLocaleString()})` : ""}.`,
        `Overall engagement is rated ${level.toLowerCase()} with an estimated ${contributionPct}% share of the group's contribution.`,
      ].filter(Boolean).join(" ");

  return {
    overall_score: overallScore,
    engagement_level: level,
    voice_score: clampScore(voiceScore),
    presence_score: clampScore(presenceScore),
    writing_score: clampScore(writingScore),
    consistency_score: clampScore(consistency),
    active_time_score: clampScore(activeTimeScore),
    voice_content_score: clampScore(voiceContent),
    narrative,
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4),
    contribution_pct: contributionPct,
  };
}

/** Process one IoT reading payload into the row that should be stored. */
export function buildIotRow(
  input: { device_id: string; voice: unknown; face: unknown; face_expression: unknown; transcript: unknown },
  voiceAnalysis: VoiceAnalysis | null,
) {
  const voice = Number(input.voice) === 1 ? 1 : 0;
  const face = Number(input.face) === 1 ? 1 : 0;
  const faceExpr: FaceExpression = VALID_EXPRESSIONS.includes(input.face_expression as FaceExpression)
    ? (input.face_expression as FaceExpression)
    : face ? "NEUTRAL" : "ABSENT";
  const transcript = typeof input.transcript === "string" && input.transcript.trim().length > 4 ? input.transcript.trim() : null;
  const va: VoiceAnalysis = { ...(voiceAnalysis ?? DEFAULT_VOICE_ANALYSIS), voice_flags: [...(voiceAnalysis?.voice_flags ?? [])] };

  if (faceExpr === "DROWSY" && !va.voice_flags.some((f) => f.includes("drowsy"))) va.voice_flags = [...va.voice_flags, "drowsy"].slice(0, 3);
  if (faceExpr === "DISTRACTED" && !va.voice_flags.some((f) => f.includes("distracted"))) va.voice_flags = [...va.voice_flags, "distracted"].slice(0, 3);
  if (faceExpr === "FOCUSED" && !va.voice_summary) va.voice_summary = "Member is focused on laptop work — silent but actively contributing.";

  const engagement = computeEngagementScore(voice, face, faceExpr, transcript && voiceAnalysis ? va.voice_quality_score : null);
  const { level, pct } = computeContributionLevel(engagement);
  const isActive = engagement >= 50;

  return {
    faceExpr,
    hasTranscript: !!transcript,
    voiceAnalysis: va,
    row: {
      device_id: input.device_id,
      voice,
      face,
      face_expression: faceExpr,
      contribution_level: level,
      contribution_pct: clampScore(pct),
      engagement_score: engagement,
      is_actively_engaged: isActive,
      passive_presence: face === 1 && !isActive,
      transcript,
      voice_quality: va.voice_quality,
      voice_quality_score: va.voice_quality_score,
      voice_sentiment: va.voice_sentiment,
      detected_language: va.detected_language,
      voice_topics: va.voice_topics,
      voice_flags: va.voice_flags,
      voice_summary: va.voice_summary || null,
    },
  };
}
