import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";

export type LlmProvider = "anthropic" | "gemini" | "groq";

export interface LlmResult<T = Record<string, unknown>> {
  data: T;
  provider: LlmProvider;
}

function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/m, "").trim();
}

export async function callLlmJson<T = Record<string, unknown>>(
  prompt: string,
  options?: {
    anthropicModel?: string;
    anthropicMaxTokens?: number;
    anthropicAdaptiveThinking?: boolean;
  },
): Promise<LlmResult<T> | null> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (anthropicKey) {
    try {
      const claude = new Anthropic({ apiKey: anthropicKey });
      const req: Record<string, unknown> = {
        model: options?.anthropicModel ?? "claude-haiku-4-5",
        max_tokens: options?.anthropicMaxTokens ?? 800,
        messages: [{ role: "user", content: prompt }],
      };
      if (options?.anthropicAdaptiveThinking) {
        req.thinking = { type: "adaptive" };
      }
      const response = await claude.messages.create(req as Parameters<typeof claude.messages.create>[0]);
      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        const parsed = JSON.parse(stripJsonFences(textBlock.text)) as T;
        return { data: parsed, provider: "anthropic" };
      }
    } catch {
      // Fall through to next provider or rule-based fallback
    }
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      );
      if (res.ok) {
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("");
        if (text) {
          const parsed = JSON.parse(stripJsonFences(text)) as T;
          return { data: parsed, provider: "gemini" };
        }
      }
    } catch {
      // Fall through to next provider or rule-based fallback
    }
  }

  const groqKey = Deno.env.get("GROQ_API_KEY")?.trim();
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.trim()) {
          const parsed = JSON.parse(stripJsonFences(text)) as T;
          return { data: parsed, provider: "groq" };
        }
      }
    } catch {
      // Fall through to rule-based fallback
    }
  }

  return null;
}
