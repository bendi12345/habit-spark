import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isCrisisMessage } from "@/lib/coach-safety";

const crisisResponse = "Sajnálom, hogy ilyen nehéz most. Fontos, hogy ne maradj egyedül: szólj valakinek, akiben megbízol, és kérj azonnali segítséget. Közvetlen veszélyben hívd a 112-t. Itt maradok veled, ha szeretnéd, és segítek a következő biztonságos lépésre figyelni.";

export const coachReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    message: z.string().trim().min(1).max(2000),
    context: z.string().max(2000),
    tone: z.enum(["friendly", "mentor", "direct"]),
  }).parse(data))
  .handler(async ({ data }) => {
    if (isCrisisMessage(data.message)) {
      return {
        ok: true as const,
        crisis: true,
        reply: crisisResponse,
      };
    }

    const { aiJson, AiError } = await import("./ai-gateway.server");
    const tone = {
      friendly: "barátságos, együttérző társként",
      mentor: "nyugodt, bölcs mentorként",
      direct: "egyenes, de kedves segítőként",
    }[data.tone];
    try {
      const result = await aiJson<{ reply: string; crisis: boolean }>({
        system: `Magyar nyelvű, támogató szokásváltó coach vagy. Válaszolj ${tone}. Legyél rövid, ítélkezésmentes és gyakorlatias. Ne szégyeníts, ne diagnosztizálj, ne javasolj fájdalmat, sokkot vagy veszélyes módszert, és ne adj orvosi kezelési vagy megvonási utasításokat. Alkohol, gyógyszer vagy más szer megvonási kockázatánál finoman javasold orvos vagy szakember felkeresését. Ha a felhasználó visszaesésről számol be, ismerd el együttérzően, és segíts neki egy apró következő lépést választani. Ha az üzenet önsértésre, öngyilkossági gondolatra vagy közvetlen veszélyre utal, állítsd a crisis mezőt true-ra; egyébként false. Ilyenkor a választ is rövid, empatikus és biztonságra irányuló szövegként írd. A megadott állapot csak háttérinformáció; ne állíts róla többet, mint amit tartalmaz.`,
        user: JSON.stringify({ context: data.context, message: data.message }),
        schemaName: "coach_reply",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["reply", "crisis"],
          properties: { reply: { type: "string", minLength: 1, maxLength: 1500 }, crisis: { type: "boolean" } },
        },
      });
      return {
        ok: true as const,
        crisis: result.crisis,
        reply: result.crisis ? crisisResponse : result.reply.slice(0, 1500),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof AiError ? error.message : "A coach most nem érhető el. Próbáld meg később.",
      };
    }
  });
