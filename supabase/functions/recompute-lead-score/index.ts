// Placeholder edge function: returns a canned lead score.
// A real AI service will replace this later — the UI is already wired up.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contact_id } = await req.json();
    if (!contact_id) throw new Error("contact_id required");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Load the contact so we can echo something realistic.
    const { data: contact, error: readErr } = await supabase
      .from("contacts")
      .select("id,name,pipeline_stage,age,income,tags")
      .eq("id", contact_id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!contact) throw new Error("Contact not found");

    // Canned scoring: deterministic pseudo-random between 20 and 95.
    let seed = 0;
    for (const c of contact.id) seed = (seed * 31 + c.charCodeAt(0)) | 0;
    const rand = Math.abs(seed % 76) + 20;

    const stageBoost: Record<string, number> = {
      new: 0,
      contacted: 5,
      qualified: 10,
      proposal: 15,
      won: 20,
      lost: -20,
    };
    const raw = rand + (stageBoost[contact.pipeline_stage as string] ?? 0);
    const lead_score = Math.max(0, Math.min(100, raw));

    const { error: updErr } = await supabase
      .from("contacts")
      .update({ lead_score })
      .eq("id", contact_id);
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        ok: true,
        lead_score,
        source: "stub",
        note: "Canned response — replace with real AI scoring service.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
