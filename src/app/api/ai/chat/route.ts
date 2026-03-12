import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user + tenant + subscription
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, tenants(id, name, subscriptions(plan, status))")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return Response.json({ error: "No tenant found" }, { status: 403 });
    }

    const tenantId = userData.tenant_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = userData.tenants as any as { id: string; name: string; subscriptions?: { plan: string; status: string }[] | { plan: string; status: string } | null } | null;

    // Get plan
    let plan = "basic";
    if (tenant?.subscriptions) {
      const subs = Array.isArray(tenant.subscriptions)
        ? tenant.subscriptions[0]
        : tenant.subscriptions;
      if (subs?.plan) plan = subs.plan;
    }

    // Plan gate — Basic plan cannot use AI Copilot
    if (plan === "basic") {
      return Response.json(
        { error: "AI Copilot requires Pro or Ultimate plan" },
        { status: 403 }
      );
    }

    // Rate limiting — 20 requests per minute per tenant
    const rateKey = `rate:ai:${tenantId}`;
    const count = await redis.incr(rateKey);
    if (count === 1) {
      await redis.expire(rateKey, 60);
    }
    if (count > 20) {
      return Response.json(
        { error: "Rate limit exceeded. Please wait a moment before trying again." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { message, conversationId } = body as {
      message: string;
      conversationId?: string;
    };

    if (!message?.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Fetch business context using service role
    const adminClient = createAdminClient();

    const [
      { count: customerCount },
      { count: activeJobsCount },
      { count: activeRepairsCount },
      { count: inventoryCount },
      { count: passportCount },
    ] = await Promise.all([
      adminClient
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      adminClient
        .from("bespoke_jobs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not("stage", "in", '("completed","cancelled")'),
      adminClient
        .from("repairs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not("stage", "in", '("collected","cancelled")'),
      adminClient
        .from("inventory")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .is("deleted_at", null),
      adminClient
        .from("passports")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
    ]);

    // Outstanding invoices
    const { data: outstandingData } = await adminClient
      .from("invoices")
      .select("amount_due")
      .eq("tenant_id", tenantId)
      .in("status", ["sent", "partially_paid", "overdue"])
      .is("deleted_at", null);

    const outstandingCount = outstandingData?.length ?? 0;
    const outstandingAmount = (outstandingData ?? []).reduce(
      (sum, inv) => sum + (inv.amount_due || 0),
      0
    );

    // Low stock count
    const { data: lowStockItems } = await adminClient
      .from("inventory")
      .select("quantity, low_stock_threshold, track_quantity")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .is("deleted_at", null)
      .eq("track_quantity", true);

    const lowStockCount = (lowStockItems ?? []).filter(
      (i) => i.quantity <= (i.low_stock_threshold ?? 1)
    ).length;

    const businessName = tenant?.name ?? "your business";

    const systemPrompt = `You are an AI Business Copilot for ${businessName}, a jewellery business using Nexpura. 
You help jewellers run their business better. You have access to their business data.

Current business context:
- Total customers: ${customerCount ?? 0}
- Active bespoke jobs: ${activeJobsCount ?? 0}
- Active repairs: ${activeRepairsCount ?? 0}
- Outstanding invoices: ${outstandingCount} totalling $${outstandingAmount.toFixed(2)}
- Inventory items: ${inventoryCount ?? 0}
- Low stock alerts: ${lowStockCount}
- Digital passports issued: ${passportCount ?? 0}

You can help with:
- Business insights and analysis
- Pricing strategies for jewellery
- Customer communication tips
- Workflow optimisation
- Understanding their data
- Jewellery industry knowledge

Be concise, practical, and professional. You know jewellery.`;

    // Get or create conversation
    let convoId = conversationId;
    if (!convoId) {
      const { data: newConvo, error: convoError } = await adminClient
        .from("ai_conversations")
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          title: message.slice(0, 80),
        })
        .select("id")
        .single();

      if (convoError || !newConvo) {
        return Response.json({ error: "Failed to create conversation" }, { status: 500 });
      }
      convoId = newConvo.id;
    }

    // Save user message
    await adminClient.from("ai_messages").insert({
      conversation_id: convoId,
      tenant_id: tenantId,
      role: "user",
      content: message,
    });

    // Fetch conversation history for context
    const { data: history } = await adminClient
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Stream response
    const result = streamText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      system: systemPrompt,
      messages,
      onFinish: async ({ text, usage }) => {
        // Save assistant message
        await adminClient.from("ai_messages").insert({
          conversation_id: convoId,
          tenant_id: tenantId,
          role: "assistant",
          content: text,
          tokens_used: (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
        });

        // Update conversation updated_at + title if it was just created
        await adminClient
          .from("ai_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convoId!);
      },
    });

    const response = result.toTextStreamResponse();
    // Inject conversation ID header
    const headers = new Headers(response.headers);
    headers.set("X-Conversation-Id", convoId!);
    // Expose the header to the browser
    headers.set("Access-Control-Expose-Headers", "X-Conversation-Id");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (err) {
    console.error("AI chat error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
