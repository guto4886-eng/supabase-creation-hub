import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = await req.json();
    const { records, action } = body;
    
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    // For seed/clear actions, accept anon key as apikey header (server-to-server)
    const apiKey = req.headers.get("apikey") || "";
    const isSeedAction = action === "seed" || action === "clear_defaults";
    
    if (isSeedAction) {
      if (apiKey !== anonKey && token !== serviceRoleKey) {
        return new Response(JSON.stringify({ error: "Unauthorized for seed" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: { user }, error } = await anonClient.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "clear_defaults") {
      const { error } = await adminClient.from("sinapi_items").delete().eq("is_default", true);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: "Cleared" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return new Response(JSON.stringify({ error: "No records" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRecords = records.map((r: Record<string, unknown>) => ({
      code: String(r.code || ""),
      description: String(r.description || ""),
      unit: String(r.unit || "un"),
      unit_price: Number(r.unit_price) || 0,
      category: r.category ? String(r.category) : null,
      item_type: String(r.item_type || "insumo"),
      pricing_type: String(r.pricing_type || "sem_desoneracao"),
      state: String(r.state || "SP"),
      price_origin: r.price_origin ? String(r.price_origin) : null,
      is_default: true,
      reference_date: r.reference_date ? String(r.reference_date) : null,
    }));

    let inserted = 0;
    let errors = 0;
    const BATCH = 500;

    for (let i = 0; i < validRecords.length; i += BATCH) {
      const batch = validRecords.slice(i, i + BATCH);
      const { error } = await adminClient
        .from("sinapi_items")
        .upsert(batch, { onConflict: "code,state,pricing_type,item_type", ignoreDuplicates: false });
      if (error) {
        console.error(`Batch error at ${i}: ${error.message}`);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted, errors, total: validRecords.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
