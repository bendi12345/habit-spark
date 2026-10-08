import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey)
    return Response.json({ error: "Duel service is not configured." }, { status: 503 });
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const action = body.action;
  let result: { data: unknown; error: { message: string } | null };
  if (action === "create") {
    if (
      typeof body.opponent !== "string" ||
      !UUID.test(body.opponent) ||
      ![1, 3, 7].includes(Number(body.days)) ||
      !Number.isInteger(body.difficulty) ||
      Number(body.difficulty) < 1 ||
      Number(body.difficulty) > 10 ||
      !Number.isInteger(body.stake) ||
      Number(body.stake) < 0 ||
      typeof body.title !== "string" ||
      typeof body.description !== "string"
    ) {
      return Response.json({ error: "Invalid duel settings." }, { status: 400 });
    }
    result = await client.rpc("create_duel_with_challenge", {
      _opponent: body.opponent,
      _days: Number(body.days),
      _difficulty: Number(body.difficulty),
      _stake: Number(body.stake),
      _title: body.title,
      _description: body.description,
    });
    if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
    return Response.json({ duelId: result.data });
  }

  if (action === "accept") {
    if (
      typeof body.duelId !== "string" ||
      !UUID.test(body.duelId) ||
      typeof body.title !== "string" ||
      typeof body.description !== "string"
    ) {
      return Response.json({ error: "Invalid duel acceptance." }, { status: 400 });
    }
    result = await client.rpc("accept_duel_with_challenge", {
      _duel: body.duelId,
      _title: body.title,
      _description: body.description,
    });
  } else {
    if (typeof body.duelId !== "string" || !UUID.test(body.duelId)) {
      return Response.json({ error: "A valid duelId is required." }, { status: 400 });
    }
    switch (action) {
      case "counter":
        if (!Number.isInteger(body.stake) || Number(body.stake) < 0)
          return Response.json({ error: "Invalid counter stake." }, { status: 400 });
        result = await client.rpc("counter_duel", {
          _duel: body.duelId,
          _stake: Number(body.stake),
        });
        break;
      case "decline":
        result = await client.rpc("decline_duel", { _duel: body.duelId });
        break;
      case "forfeit":
        result = await client.rpc("forfeit_duel", { _duel: body.duelId });
        break;
      case "expire":
        result = await client.rpc("expire_duel", { _duel: body.duelId });
        break;
      default:
        return Response.json({ error: "Unsupported duel action." }, { status: 400 });
    }
  }
  if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
  return Response.json({ ok: true, result: result.data });
});
