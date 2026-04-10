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
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user is authenticated
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { records, action } = await req.json();

    // Use service role to bypass RLS for default items
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "clear_defaults") {
      const { error } = await adminClient
        .from("sinapi_items")
        .delete()
        .eq("is_default", true);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: "Cleared all default SINAPI items" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return new Response(JSON.stringify({ error: "No records provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate records
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

    // Insert in sub-batches of 500
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
