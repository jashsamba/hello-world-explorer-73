import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Database } from "https://esm.sh/@supabase/supabase-js@2.45.0/supabase-types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
};

interface PurchaseRequest {
  first_name: string;
  last_name: string;
  email: string;
  contact_number?: string;
  postal_code?: string;
  tickets: Record<string, number>;
  add_ons: Record<string, number>;
  totals: {
    subtotal: number;
    tax: number;
    service_fee: number;
    total: number;
  };
  session_token: string;
}

interface Prices {
  [key: string]: number;
}

const TICKET_PRICES: Prices = {
  'adult-general': 19.99,
  'child-general': 14.99,
  'senior-general': 16.99,
  'student-general': 16.99,
};

const ADDON_PRICES = {
  'donation-5': 5.00,
  'donation-10': 10.00,
  'donation-25': 25.00,
  'field-trip': 17.00,
  'bus-subsidy': 15.00,
};

const TAX_RATE = 0.13; // 13% tax
const SERVICE_FEE_RATE = 0.02; // 2% service fee

function validateEmail(email: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
}

function sanitizeInput(input: string): string {
  return input.replace(/[<>"'&]/g, '').trim();
}

function validatePurchaseData(data: PurchaseRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate required fields
  if (!data.first_name || data.first_name.length === 0 || data.first_name.length > 100) {
    errors.push("Invalid first name");
  }
  if (!data.last_name || data.last_name.length === 0 || data.last_name.length > 100) {
    errors.push("Invalid last name");
  }
  if (!data.email || !validateEmail(data.email)) {
    errors.push("Invalid email address");
  }

  // Validate totals calculation
  let calculatedSubtotal = 0;
  
  // Calculate ticket subtotal
  for (const [ticketId, quantity] of Object.entries(data.tickets || {})) {
    if (quantity > 0) {
      const price = TICKET_PRICES[ticketId as keyof typeof TICKET_PRICES];
      if (!price) {
        errors.push(`Invalid ticket type: ${ticketId}`);
        continue;
      }
      if (quantity > 50) { // Reasonable limit
        errors.push(`Too many tickets of type ${ticketId}`);
        continue;
      }
      calculatedSubtotal += price * quantity;
    }
  }

  // Calculate addon subtotal
  for (const [addonId, quantity] of Object.entries(data.add_ons || {})) {
    if (quantity > 0) {
      const price = ADDON_PRICES[addonId as keyof typeof ADDON_PRICES];
      if (!price) {
        errors.push(`Invalid addon type: ${addonId}`);
        continue;
      }
      if (quantity > 10) { // Reasonable limit
        errors.push(`Too many addons of type ${addonId}`);
        continue;
      }
      calculatedSubtotal += price * quantity;
    }
  }

  const calculatedTax = Math.round(calculatedSubtotal * TAX_RATE * 100) / 100;
  const calculatedServiceFee = Math.round(calculatedSubtotal * SERVICE_FEE_RATE * 100) / 100;
  const calculatedTotal = calculatedSubtotal + calculatedTax + calculatedServiceFee;

  // Validate totals match (allow small rounding differences)
  const tolerance = 0.02;
  if (Math.abs(data.totals.subtotal - calculatedSubtotal) > tolerance) {
    errors.push("Subtotal mismatch");
  }
  if (Math.abs(data.totals.tax - calculatedTax) > tolerance) {
    errors.push("Tax calculation mismatch");
  }
  if (Math.abs(data.totals.service_fee - calculatedServiceFee) > tolerance) {
    errors.push("Service fee mismatch");
  }
  if (Math.abs(data.totals.total - calculatedTotal) > tolerance) {
    errors.push("Total calculation mismatch");
  }

  return { valid: errors.length === 0, errors };
}

async function logAuditEvent(
  supabase: SupabaseClient<Database>,
  eventType: string,
  req: Request,
  sessionToken?: string,
  purchaseData?: any,
  errorMessage?: string
) {
  try {
    const clientIP = req.headers.get("x-forwarded-for") || 
                    req.headers.get("x-real-ip") || 
                    "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    await supabase.from("purchase_audit_log").insert({
      event_type: eventType,
      ip_address: clientIP,
      user_agent: userAgent,
      session_token: sessionToken,
      purchase_data: purchaseData,
      error_message: errorMessage,
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

async function checkRateLimit(supabase: SupabaseClient<Database>, sessionToken: string, clientIP: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Check session-based rate limiting
    const { data: session } = await supabase
      .from("purchase_sessions")
      .select("*")
      .eq("session_token", sessionToken)
      .single();

    const now = new Date();
    
    if (session) {
      // Check if session is expired
      if (new Date(session.expires_at) < now) {
        return { allowed: false, reason: "Session expired" };
      }

      // Check if last purchase was within rate limit (1 per minute)
      if (session.last_purchase_attempt) {
        const lastAttempt = new Date(session.last_purchase_attempt);
        const timeDiff = now.getTime() - lastAttempt.getTime();
        if (timeDiff < 60000) { // 1 minute
          return { allowed: false, reason: "Rate limit exceeded" };
        }
      }

      // Check daily purchase limit (10 per day per session)
      if (session.purchase_count >= 10) {
        return { allowed: false, reason: "Daily purchase limit exceeded" };
      }

      // Update session
      await supabase
        .from("purchase_sessions")
        .update({
          last_purchase_attempt: now.toISOString(),
          purchase_count: session.purchase_count + 1,
          ip_address: clientIP,
        })
        .eq("session_token", sessionToken);
    } else {
      // Create new session
      await supabase.from("purchase_sessions").insert({
        session_token: sessionToken,
        ip_address: clientIP,
        last_purchase_attempt: now.toISOString(),
        purchase_count: 1,
        expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour
      });
    }

    return { allowed: true };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return { allowed: false, reason: "Rate limit check failed" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient<Database>(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const requestData: PurchaseRequest = await req.json();
    const clientIP = req.headers.get("x-forwarded-for") || 
                    req.headers.get("x-real-ip") || 
                    "unknown";

    await logAuditEvent(supabase, "attempt", req, requestData.session_token, requestData);

    // Validate session token exists
    if (!requestData.session_token) {
      await logAuditEvent(supabase, "failure", req, undefined, requestData, "Missing session token");
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(supabase, requestData.session_token, clientIP);
    if (!rateLimitCheck.allowed) {
      await logAuditEvent(supabase, "failure", req, requestData.session_token, requestData, `Rate limit: ${rateLimitCheck.reason}`);
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate input data
    const validation = validatePurchaseData(requestData);
    if (!validation.valid) {
      await logAuditEvent(supabase, "failure", req, requestData.session_token, requestData, `Validation failed: ${validation.errors.join(', ')}`);
      return new Response(JSON.stringify({ error: "Invalid purchase data", details: validation.errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize input data
    const sanitizedData = {
      first_name: sanitizeInput(requestData.first_name),
      last_name: sanitizeInput(requestData.last_name),
      email: requestData.email.toLowerCase().trim(),
      contact_number: requestData.contact_number ? sanitizeInput(requestData.contact_number) : null,
      postal_code: requestData.postal_code ? sanitizeInput(requestData.postal_code) : null,
      tickets: requestData.tickets,
      add_ons: requestData.add_ons,
      subtotal: requestData.totals.subtotal,
      tax: requestData.totals.tax,
      service_fee: requestData.totals.service_fee,
      total: requestData.totals.total,
      status: 'completed',
      payment_method: 'card',
    };

    // Insert purchase record
    const { data: purchaseData, error: insertError } = await supabase
      .from("ticket_purchases")
      .insert(sanitizedData)
      .select()
      .single();

    if (insertError) {
      await logAuditEvent(supabase, "failure", req, requestData.session_token, requestData, `Database insert failed: ${insertError.message}`);
      return new Response(JSON.stringify({ error: "Failed to save purchase" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logAuditEvent(supabase, "success", req, requestData.session_token, { purchase_id: purchaseData.id });

    // Send notification webhook (if configured)
    const webhookUrl = Deno.env.get("PURCHASE_WEBHOOK_URL");
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "MuseumKiosk/1.0",
          },
          body: JSON.stringify({
            purchase_id: purchaseData.id,
            customer_email: sanitizedData.email,
            total: sanitizedData.total,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (webhookError) {
        console.error("Webhook notification failed:", webhookError);
        // Don't fail the purchase if webhook fails
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      purchase_id: purchaseData.id,
      session_token: requestData.session_token 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Purchase processing error:", error);
    await logAuditEvent(supabase, "failure", req, undefined, undefined, error.message);
    
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});