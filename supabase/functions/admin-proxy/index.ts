import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://m3dkzn.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL env var is not set. Run 'supabase secrets set SUPABASE_URL=...'");
}

if (!SERVICE_ROLE_KEY) {
  throw new Error("SERVICE_ROLE_KEY env var is not set. Run 'supabase secrets set SERVICE_ROLE_KEY=...'");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const incomingUrl = new URL(req.url);
    const rawPath = incomingUrl.searchParams.get("path");
    if (!rawPath) {
      return new Response(JSON.stringify({ error: "Missing path query parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUrl = rawPath.startsWith("http") ? rawPath : `${SUPABASE_URL}${rawPath}`;

    const forwardedHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      if (!["content-length"].includes(key.toLowerCase())) {
        forwardedHeaders[key] = value;
      }
    });

    forwardedHeaders["apikey"] = SERVICE_ROLE_KEY;
    forwardedHeaders["Authorization"] = `Bearer ${SERVICE_ROLE_KEY}`;

    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardedHeaders,
      body,
    });

    const responseBody = await response.text();
    const headers = new Headers(corsHeaders);
    const contentType = response.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);

    return new Response(responseBody, {
      status: response.status,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
