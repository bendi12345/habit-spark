// Server-only helper: streams a Lovable AI Gateway Responses call and returns parsed JSON.
export class AiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function aiJson<T>(opts: { system: string; user: string; schemaName: string; schema: object }): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(401, "AI is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions: opts.system,
      input: [{ role: "user", content: opts.user }],
      text: { format: { type: "json_schema", name: opts.schemaName, strict: true, schema: opts.schema } },
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    console.error("AI gateway error", res.status, body);
    const msg = res.status === 429 ? "Too many requests — try again in a minute."
      : res.status === 402 ? "AI credits are used up for this workspace."
      : "The AI couldn't respond right now.";
    throw new AiError(res.status, msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === "response.output_text.delta") text += ev.delta;
        if (ev.type === "response.refusal.delta" || ev.type === "response.failed") throw new AiError(422, "The AI declined this request.");
      } catch (e) { if (e instanceof AiError) throw e; }
    }
  }
  try { return JSON.parse(text) as T; } catch { throw new AiError(500, "The AI returned an unreadable answer. Please try again."); }
}
