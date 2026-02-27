import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getLocationToken, GHL_API_URL } from "../_shared/ghl-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { locationId, contactId, updates, tags, removeTags, notes, workflowId } = await req.json();

    if (!locationId || !contactId) {
      return new Response(JSON.stringify({ error: "Missing locationId or contactId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = await getLocationToken(supabaseClient, locationId);

    const results: any = {};

    // 1. Update basic fields and custom fields
    if (updates) {
      const updateBody: any = {};
      if (updates.firstName) updateBody.firstName = updates.firstName;
      if (updates.lastName) updateBody.lastName = updates.lastName;
      if (updates.name) updateBody.name = updates.name;
      if (updates.email) updateBody.email = updates.email;
      if (updates.phone) updateBody.phone = updates.phone;
      if (updates.businessName) updateBody.businessName = updates.businessName;
      if (updates.companyName) updateBody.companyName = updates.companyName;
      if (updates.company) updateBody.company = updates.company;
      if (updates.customFields) {
        updateBody.customFields = updates.customFields.map((cf: any) => ({
          id: cf.id,
          value: cf.field_value // GHL uses 'value' in the update payload
        }));
      }

      const res = await fetch(`${GHL_API_URL}/contacts/${contactId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Version": "2021-07-28"
        },
        body: JSON.stringify(updateBody)
      });
      results.updateContact = await res.json();
    }

    // 2. Add tags
    if (tags && tags.length > 0) {
      const res = await fetch(`${GHL_API_URL}/contacts/${contactId}/tags`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Version": "2021-07-28"
        },
        body: JSON.stringify({ tags })
      });
      results.addTags = await res.json();
    }

    // 3. Remove tags
    if (removeTags && removeTags.length > 0) {
      const res = await fetch(`${GHL_API_URL}/contacts/${contactId}/tags`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Version": "2021-07-28"
        },
        body: JSON.stringify({ tags: removeTags })
      });
      results.removeTags = await res.json();
    }

    // 4. Add notes
    if (notes && notes.length > 0) {
      results.notes = [];
      for (const note of notes) {
        const res = await fetch(`${GHL_API_URL}/contacts/${contactId}/notes`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Version": "2021-07-28"
          },
          body: JSON.stringify({ body: note })
        });
        results.notes.push(await res.json());
      }
    }

    // 5. Add to workflow
    if (workflowId) {
      const res = await fetch(`${GHL_API_URL}/contacts/${contactId}/workflow/${workflowId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Version": "2021-07-28"
        }
      });
      results.workflow = await res.json();
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

