/**
 * Mailchimp Integration
 * 
 * Sync customers to Mailchimp audience with tags based on segments.
 * Requires tenant to configure Mailchimp API key + list ID.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegration, upsertIntegration } from "@/lib/integrations";

interface MailchimpConfig {
  api_key: string;
  server_prefix: string; // e.g., "us14" from API key suffix
  list_id: string;
  auto_sync: boolean;
  last_sync?: string;
}

interface MailchimpMember {
  email_address: string;
  status: "subscribed" | "unsubscribed" | "pending";
  merge_fields: {
    FNAME?: string;
    LNAME?: string;
    PHONE?: string;
  };
  tags?: string[];
}

function getServerPrefix(apiKey: string): string {
  // API key format: xxxxx-us14
  const parts = apiKey.split("-");
  return parts[parts.length - 1] || "us1";
}

async function mailchimpFetch(
  apiKey: string,
  serverPrefix: string,
  path: string,
  options?: RequestInit
) {
  const url = `https://${serverPrefix}.api.mailchimp.com/3.0${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Mailchimp API error ${res.status}`);
  }
  return res.json();
}

/**
 * Sync all customers with marketing consent to Mailchimp
 */
export async function syncToMailchimp(tenantId: string): Promise<{
  success: boolean;
  synced: number;
  errors: string[];
}> {
  const integration = await getIntegration(tenantId, "mailchimp" as any);
  if (!integration) return { success: false, synced: 0, errors: ["Mailchimp not connected"] };

  const config = integration.config as unknown as MailchimpConfig;
  const { api_key, list_id } = config;
  const serverPrefix = config.server_prefix || getServerPrefix(api_key);

  const admin = createAdminClient();
  let synced = 0;
  const errors: string[] = [];

  // Get customers with marketing consent
  const { data: customers } = await admin
    .from("customers")
    .select("id, full_name, email, mobile, marketing_consent, tags")
    .eq("tenant_id", tenantId)
    .eq("marketing_consent", true)
    .not("email", "is", null)
    .limit(500);

  if (!customers?.length) {
    return { success: true, synced: 0, errors: [] };
  }

  // Batch upsert to Mailchimp
  const batchOperations = customers.map(c => {
    const nameParts = (c.full_name || "").split(" ");
    const fname = nameParts[0] || "";
    const lname = nameParts.slice(1).join(" ") || "";
    const memberHash = Buffer.from(c.email!.toLowerCase()).toString("base64url");
    
    // Build tags from customer tags if available
    const tagList: string[] = [];
    if (Array.isArray(c.tags)) tagList.push(...c.tags);

    const member: MailchimpMember = {
      email_address: c.email!,
      status: "subscribed",
      merge_fields: {
        FNAME: fname,
        LNAME: lname,
        PHONE: c.mobile || "",
      },
      tags: tagList,
    };

    return {
      method: "PUT",
      path: `/lists/${list_id}/members/${memberHash}`,
      body: JSON.stringify(member),
      operation_id: c.id,
    };
  });

  // Process in batches of 500 (Mailchimp batch limit)
  const BATCH_SIZE = 500;
  for (let i = 0; i < batchOperations.length; i += BATCH_SIZE) {
    const batch = batchOperations.slice(i, i + BATCH_SIZE);
    try {
      await mailchimpFetch(api_key, serverPrefix, "/batches", {
        method: "POST",
        body: JSON.stringify({ operations: batch }),
      });
      synced += batch.length;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Batch failed");
    }
  }

  // Update last sync
  await upsertIntegration(tenantId, "mailchimp" as any, {
    ...config,
    last_sync: new Date().toISOString(),
  });

  return { success: errors.length === 0, synced, errors };
}

/**
 * Connect Mailchimp — validate API key and get lists
 */
export async function connectMailchimp(
  tenantId: string,
  apiKey: string,
  listId: string,
  autoSync = true
): Promise<{ success: boolean; error?: string }> {
  const serverPrefix = getServerPrefix(apiKey);

  // Validate by fetching account info
  try {
    await mailchimpFetch(apiKey, serverPrefix, "/ping");
  } catch {
    return { success: false, error: "Invalid API key — could not connect to Mailchimp" };
  }

  // Validate list
  try {
    await mailchimpFetch(apiKey, serverPrefix, `/lists/${listId}`);
  } catch {
    return { success: false, error: "Audience not found — check the list ID" };
  }

  await upsertIntegration(tenantId, "mailchimp" as any, {
    api_key: apiKey,
    server_prefix: serverPrefix,
    list_id: listId,
    auto_sync: autoSync,
  });

  return { success: true };
}

/**
 * Get Mailchimp lists for a given API key
 */
export async function getMailchimpLists(apiKey: string): Promise<{
  lists?: Array<{ id: string; name: string; stats: { member_count: number } }>;
  error?: string;
}> {
  const serverPrefix = getServerPrefix(apiKey);
  try {
    const data = await mailchimpFetch(apiKey, serverPrefix, "/lists?count=100");
    return { lists: data.lists || [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to fetch lists" };
  }
}
