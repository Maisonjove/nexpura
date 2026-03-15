import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeDelete(fn: () => PromiseLike<any>) {
  try {
    await fn();
  } catch (e) {
    console.error("safeDelete error:", e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeInsert(fn: () => PromiseLike<any>) {
  try {
    await fn();
  } catch (e) {
    console.error("safeInsert error:", e);
  }
}

export async function GET(request: NextRequest) {
  const admin = createAdminClient();

  // ── DELETE PHASE (FK-safe order) ────────────────────────────────────────────

  // 0. job_attachments and job_events
  await safeDelete(() => admin.from("job_attachments").delete().eq("tenant_id", TENANT_ID));
  await safeDelete(() => admin.from("job_events").delete().eq("tenant_id", TENANT_ID));

  // 1. payments
  await safeDelete(() => admin.from("payments").delete().eq("tenant_id", TENANT_ID));

  // 2. invoice_line_items (direct tenant delete)
  await safeDelete(() => admin.from("invoice_line_items").delete().eq("tenant_id", TENANT_ID));

  // 3. invoices
  await safeDelete(() => admin.from("invoices").delete().eq("tenant_id", TENANT_ID));

  // 4. layby_payments (before sale_items/sales)
  await safeDelete(() => admin.from("layby_payments").delete().eq("tenant_id", TENANT_ID));

  // 5. sale_items (via sales join)
  const { data: saleRows } = await admin
    .from("sales")
    .select("id")
    .eq("tenant_id", TENANT_ID);
  const saleIds = saleRows?.map((s: { id: string }) => s.id) ?? [];
  if (saleIds.length > 0) {
    await safeDelete(() =>
      admin.from("sale_items").delete().in("sale_id", saleIds)
    );
  }

  // 6. sales
  await safeDelete(() => admin.from("sales").delete().eq("tenant_id", TENANT_ID));

  // 6. stock_movements
  await safeDelete(() => admin.from("stock_movements").delete().eq("tenant_id", TENANT_ID));

  // 7. repairs
  await safeDelete(() => admin.from("repairs").delete().eq("tenant_id", TENANT_ID));

  // 8. bespoke_jobs
  await safeDelete(() => admin.from("bespoke_jobs").delete().eq("tenant_id", TENANT_ID));

  // 9. tasks
  await safeDelete(() => admin.from("tasks").delete().eq("tenant_id", TENANT_ID));

  // 10. appraisals
  await safeDelete(() => admin.from("appraisals").delete().eq("tenant_id", TENANT_ID));

  // 11. memo_items
  await safeDelete(() => admin.from("memo_items").delete().eq("tenant_id", TENANT_ID));

  // 12. passport_events (via passports join)
  const { data: passportRows } = await admin
    .from("passports")
    .select("id")
    .eq("tenant_id", TENANT_ID);
  const passportIds = passportRows?.map((p: { id: string }) => p.id) ?? [];
  if (passportIds.length > 0) {
    await safeDelete(() =>
      admin.from("passport_events").delete().in("passport_id", passportIds)
    );
  }

  // 13. passports
  await safeDelete(() => admin.from("passports").delete().eq("tenant_id", TENANT_ID));

  // 14. inventory
  await safeDelete(() => admin.from("inventory").delete().eq("tenant_id", TENANT_ID));

  // 15. gift_voucher_redemptions
  await safeDelete(() => admin.from("gift_voucher_redemptions").delete().eq("tenant_id", TENANT_ID));

  // 16. gift_vouchers
  await safeDelete(() => admin.from("gift_vouchers").delete().eq("tenant_id", TENANT_ID));

  // 17. refunds
  await safeDelete(() => admin.from("refunds").delete().eq("tenant_id", TENANT_ID));

  // 18. customer_store_credit_history
  await safeDelete(() => admin.from("customer_store_credit_history").delete().eq("tenant_id", TENANT_ID));

  // 19. locations
  await safeDelete(() => admin.from("locations").delete().eq("tenant_id", TENANT_ID));

  // 20. team_members
  await safeDelete(() => admin.from("team_members").delete().eq("tenant_id", TENANT_ID));

  // 21. customers
  await safeDelete(() => admin.from("customers").delete().eq("tenant_id", TENANT_ID));

  // ── SEED PHASE ──────────────────────────────────────────────────────────────

  // CUSTOMERS
  await safeInsert(() =>
    admin.from("customers").insert([
      {
        id: "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a",
        tenant_id: TENANT_ID,
        full_name: "David Moufarrej",
        email: "david.moufarrej@email.com",
        mobile: "+61412345001",
        address_line1: "12 Pitt Street",
        suburb: "Sydney",
        state: "NSW",
        postcode: "2000",
        country: "Australia",
        notes: "VIP client. Prefers platinum and diamonds.",
      },
      {
        id: "7774e408-6231-4d99-bc9f-ec657456a364",
        tenant_id: TENANT_ID,
        full_name: "Emma Williams",
        email: "emma.williams@email.com",
        mobile: "+61412345002",
        address_line1: "45 Crown Street",
        suburb: "Surry Hills",
        state: "NSW",
        postcode: "2010",
        country: "Australia",
        notes: "Interested in vintage/estate pieces.",
      },
      {
        id: "9790cd8c-e746-4a2a-995f-974b61590975",
        tenant_id: TENANT_ID,
        full_name: "James Chen",
        email: "james.chen@email.com",
        mobile: "+61412345003",
        address_line1: "88 George Street",
        suburb: "Parramatta",
        state: "NSW",
        postcode: "2150",
        country: "Australia",
        notes: "Engagement ring purchase planned.",
      },
      {
        id: "870c2497-feb4-4857-b53f-aa12ae12d41e",
        tenant_id: TENANT_ID,
        full_name: "Lina Haddad",
        email: "lina.haddad@email.com",
        mobile: "+61412345004",
        address_line1: "3 Oxford Street",
        suburb: "Paddington",
        state: "NSW",
        postcode: "2021",
        country: "Australia",
      },
      {
        id: "a436d54f-efd6-47ec-8108-e133409bd9b3",
        tenant_id: TENANT_ID,
        full_name: "Michael Tanaka",
        email: "michael.tanaka@email.com",
        mobile: "+61412345005",
        address_line1: "22 Military Road",
        suburb: "Mosman",
        state: "NSW",
        postcode: "2088",
        country: "Australia",
      },
      {
        id: "579d3617-ca48-4166-9992-2553b63b79c3",
        tenant_id: TENANT_ID,
        full_name: "Olivia Nguyen",
        email: "olivia.nguyen@email.com",
        mobile: "+61412345006",
        address_line1: "7 Hunter Street",
        suburb: "Newcastle",
        state: "NSW",
        postcode: "2300",
        country: "Australia",
      },
      {
        id: "0105ccb9-e572-4e17-a3df-9f178cd3cf11",
        tenant_id: TENANT_ID,
        full_name: "Sarah Johnson",
        email: "sarah.johnson@email.com",
        mobile: "+61412345007",
        address_line1: "15 Pacific Highway",
        suburb: "Chatswood",
        state: "NSW",
        postcode: "2067",
        country: "Australia",
      },
      {
        id: "7221e89c-89fd-4a92-9123-7e66cc9c5d6d",
        tenant_id: TENANT_ID,
        full_name: "Sophie Laurent",
        email: "sophie.laurent@email.com",
        mobile: "+61412345008",
        address_line1: "55 Macquarie Street",
        suburb: "Sydney",
        state: "NSW",
        postcode: "2000",
        country: "Australia",
        notes: "Gold and coloured stone preferences.",
      },
    ])
  );

  // CUSTOMERS — update store_credit for David Moufarrej after insert
  await safeInsert(() =>
    admin
      .from("customers")
      .update({ store_credit: 150.00 })
      .eq("id", "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a")
  );

  // LOCATIONS
  await safeInsert(() =>
    admin.from("locations").insert([
      {
        id: "b1b2c3d4-0001-0001-0001-000000000001",
        tenant_id: TENANT_ID,
        name: "Marcus & Co. Main Store",
        address: "32 Castlereagh St, Sydney NSW 2000",
        is_default: true,
      },
    ])
  );

  // TEAM MEMBERS
  await safeInsert(() =>
    admin.from("team_members").insert([
      {
        tenant_id: TENANT_ID,
        name: "Sarah (Sales)",
        email: "staff@nexpura.com",
        role: "staff",
        invite_accepted: true,
        user_id: "60392573-b7e1-43fc-b6e4-6637e69b4109",
      },
    ])
  );

  // GIFT VOUCHERS
  await safeInsert(() =>
    admin.from("gift_vouchers").insert([
      {
        id: "a1b2c3d4-0001-0001-0001-000000000001",
        tenant_id: TENANT_ID,
        code: "GV-MARC001",
        original_amount: 200.00,
        balance: 200.00,
        issued_to_name: "Emma Williams",
        issued_to_email: "emma@example.com",
        issued_by: "bd7d2c20-5727-4f80-a449-818429abecc9",
        status: "active",
        notes: "Birthday gift voucher",
      },
    ])
  );

  // INVENTORY — individual inserts to avoid "All object keys must match" PostgREST error
  for (const item of [
    { id: "67940b89-90ed-43b7-96a5-7bfc14d1ed79", tenant_id: TENANT_ID, sku: "DSR-001", name: "Diamond Solitaire Ring", item_type: "jewellery", jewellery_type: "ring", metal_type: "platinum", metal_purity: "950", stone_type: "diamond", stone_carat: 1.2, stone_colour: "D", stone_clarity: "VS1", ring_size: "N", retail_price: 18500, quantity: 1, status: "active", description: "Classic 4-claw platinum solitaire with 1.20ct D/VS1 round brilliant diamond. GIA certified." },
    { id: "6a7a4edc-20dc-4f73-b3fb-bab23ced5591", tenant_id: TENANT_ID, sku: "SHR-002", name: "Sapphire Halo Ring", item_type: "jewellery", jewellery_type: "ring", metal_type: "white gold", metal_purity: "18ct", stone_type: "sapphire", stone_carat: 1.8, ring_size: "L", retail_price: 12800, quantity: 1, status: "active", description: "18ct white gold sapphire halo ring with diamond surround." },
    { tenant_id: TENANT_ID, sku: "GDB-003", name: "Gold Diamond Bracelet", item_type: "jewellery", jewellery_type: "bracelet", metal_type: "yellow gold", metal_purity: "18ct", stone_type: "diamond", retail_price: 8400, quantity: 1, status: "active", description: "18ct yellow gold tennis bracelet with 3.5ct total diamond weight." },
    { tenant_id: TENANT_ID, sku: "PEN-004", name: "Pearl Pendant Necklace", item_type: "jewellery", jewellery_type: "necklace", metal_type: "yellow gold", metal_purity: "18ct", retail_price: 2200, quantity: 2, status: "active", description: "18ct yellow gold freshwater pearl pendant on 45cm chain." },
    { tenant_id: TENANT_ID, sku: "EDD-005", name: "Emerald Drop Earrings", item_type: "jewellery", jewellery_type: "earrings", metal_type: "white gold", metal_purity: "18ct", stone_type: "emerald", retail_price: 5600, quantity: 1, status: "active", description: "18ct white gold Colombian emerald drop earrings with diamond halos." },
    { tenant_id: TENANT_ID, sku: "RGC-006", name: "Rose Gold Chain", item_type: "jewellery", jewellery_type: "chain", metal_type: "rose gold", metal_purity: "18ct", metal_weight_grams: 8.5, retail_price: 1400, quantity: 3, status: "active", description: "18ct rose gold fine curb chain, 50cm." },
    { tenant_id: TENANT_ID, sku: "DWB-007", name: "Diamond Wedding Band", item_type: "jewellery", jewellery_type: "ring", metal_type: "platinum", metal_purity: "950", stone_type: "diamond", ring_size: "M", retail_price: 4800, quantity: 2, status: "active", description: "Platinum channel-set diamond wedding band. 0.50ct total weight." },
    { tenant_id: TENANT_ID, sku: "VBR-008", name: "Vintage Brooch", item_type: "jewellery", jewellery_type: "brooch", metal_type: "yellow gold", metal_purity: "9ct", retail_price: 950, quantity: 1, status: "active", description: "9ct gold Art Nouveau brooch with seed pearls and rose-cut diamonds. Circa 1910." },
    { tenant_id: TENANT_ID, sku: "MEN-009", name: "Men's Signet Ring", item_type: "jewellery", jewellery_type: "ring", metal_type: "yellow gold", metal_purity: "18ct", ring_size: "T", retail_price: 3200, quantity: 1, status: "active", description: "18ct yellow gold men's signet ring with flat top." },
    { tenant_id: TENANT_ID, sku: "AQP-010", name: "Aquamarine Pendant", item_type: "jewellery", jewellery_type: "pendant", metal_type: "white gold", metal_purity: "18ct", stone_type: "aquamarine", stone_carat: 3.5, retail_price: 3800, quantity: 1, status: "active", description: "18ct white gold aquamarine and diamond pendant. Oval aquamarine 3.50ct." },
  ] as const) {
    await safeInsert(() => admin.from("inventory").insert(item as never));
  }

  // REPAIRS — individual inserts; item_description + repair_type NOT NULL
  await safeInsert(() => admin.from("repairs").insert({ id: "09686ec7-0ec5-4950-ba7f-9982c9830d43", tenant_id: TENANT_ID, repair_number: "R-0001", customer_id: "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a", item_type: "ring", item_description: "Platinum solitaire ring — 4-claw, 1.20ct diamond", repair_type: "Resize (L to N) + Prong Check", work_description: "Resize platinum solitaire ring from size L to N. Check prong integrity.", stage: "in_progress", priority: "normal", quoted_price: 320, deposit_amount: 100, deposit_paid: false, due_date: "2026-03-20" }));
  await safeInsert(() => admin.from("repairs").insert({ tenant_id: TENANT_ID, repair_number: "R-0002", customer_id: "7774e408-6231-4d99-bc9f-ec657456a364", item_type: "bracelet", item_description: "18ct white gold bracelet", repair_type: "Polish, Rhodium Plate + Clasp Replacement", work_description: "Polish and rhodium plate white gold bracelet. Replace broken clasp.", stage: "quoted", priority: "normal", quoted_price: 180, deposit_paid: false, due_date: "2026-03-25" }));
  await safeInsert(() => admin.from("repairs").insert({ tenant_id: TENANT_ID, repair_number: "R-0003", customer_id: "9790cd8c-e746-4a2a-995f-974b61590975", item_type: "pendant", item_description: "Diamond pendant — 3 stones to be replaced", repair_type: "Stone Setting", work_description: "Set 3 replacement diamonds in pendant. Stones provided by client.", stage: "assessed", priority: "high", quoted_price: 450, deposit_paid: false, due_date: "2026-03-22" }));
  await safeInsert(() => admin.from("repairs").insert({ tenant_id: TENANT_ID, repair_number: "R-0004", customer_id: "870c2497-feb4-4857-b53f-aa12ae12d41e", item_type: "necklace", item_description: "48-pearl strand necklace", repair_type: "Restring on Silk", work_description: "Restring pearl necklace on silk with gold knotting. 48 pearls.", stage: "ready", priority: "normal", quoted_price: 240, final_price: 240, deposit_amount: 80, deposit_paid: true, due_date: "2026-03-15" }));
  await safeInsert(() => admin.from("repairs").insert({ tenant_id: TENANT_ID, repair_number: "R-0005", customer_id: "a436d54f-efd6-47ec-8108-e133409bd9b3", item_type: "brooch", item_description: "Vintage gold brooch", repair_type: "Service + Setting Tighten", work_description: "Full service and clean of vintage brooch. Tighten loose setting.", stage: "intake", priority: "low", quoted_price: 150, deposit_paid: false }));

  // BESPOKE JOBS — individual inserts
  await safeInsert(() => admin.from("bespoke_jobs").insert({ id: "ba62301b-0b26-423a-b02e-5a48bd7034b6", tenant_id: TENANT_ID, job_number: "B-0001", customer_id: "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a", title: "Custom Platinum Wedding Bands", description: "Matching platinum wedding bands with hand-engraved scrollwork.", stage: "in_progress", priority: "high", quoted_price: 8400, deposit_amount: 2800, deposit_paid: false, due_date: "2026-04-15" }));
  await safeInsert(() => admin.from("bespoke_jobs").insert({ tenant_id: TENANT_ID, job_number: "B-0002", customer_id: "7774e408-6231-4d99-bc9f-ec657456a364", title: "Art Deco Inspired Cocktail Ring", description: "18ct white gold cocktail ring with central aquamarine and geometric diamond surround.", stage: "assessed", priority: "normal", quoted_price: 5200, deposit_paid: false, due_date: "2026-05-01" }));
  await safeInsert(() => admin.from("bespoke_jobs").insert({ tenant_id: TENANT_ID, job_number: "B-0003", customer_id: "9790cd8c-e746-4a2a-995f-974b61590975", title: "Sapphire Halo Engagement Ring", description: "18ct white gold sapphire halo engagement ring. Ceylon blue sapphire.", stage: "quoted", priority: "urgent", quoted_price: 9800, deposit_amount: 3000, deposit_paid: false, due_date: "2026-03-30" }));

  // INVOICES — individual inserts; amount_due is a generated column (do not set it)
  // INV-0001 is for repair R-0001 (ring resize + prong check). subtotal = 290.91 + tax = 320 total
  await safeInsert(() => admin.from("invoices").insert({ id: "2c6672d1-884e-4d96-accf-b8a88ab2e27e", tenant_id: TENANT_ID, invoice_number: "INV-0001", customer_id: "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a", reference_type: "repair", reference_id: "09686ec7-0ec5-4950-ba7f-9982c9830d43", status: "partial", invoice_date: "2026-03-01", due_date: "2026-03-20", subtotal: 290.91, tax_amount: 29.09, discount_amount: 0, total: 320, amount_paid: 100, tax_name: "GST", tax_rate: 0.1 }));
  await safeInsert(() => admin.from("invoices").insert({ tenant_id: TENANT_ID, invoice_number: "INV-0002", customer_id: "7774e408-6231-4d99-bc9f-ec657456a364", reference_type: "sale", status: "unpaid", invoice_date: "2026-03-05", due_date: "2026-03-31", subtotal: 7636.36, tax_amount: 763.64, discount_amount: 0, total: 8400, amount_paid: 0, tax_name: "GST", tax_rate: 0.1 }));
  await safeInsert(() => admin.from("invoices").insert({ tenant_id: TENANT_ID, invoice_number: "INV-0003", customer_id: "9790cd8c-e746-4a2a-995f-974b61590975", reference_type: "repair", status: "unpaid", invoice_date: "2026-02-25", due_date: "2026-03-08", subtotal: 409.09, tax_amount: 40.91, discount_amount: 0, total: 450, amount_paid: 0, tax_name: "GST", tax_rate: 0.1 }));
  await safeInsert(() => admin.from("invoices").insert({ tenant_id: TENANT_ID, invoice_number: "INV-0004", customer_id: "870c2497-feb4-4857-b53f-aa12ae12d41e", reference_type: "sale", status: "paid", invoice_date: "2026-03-12", due_date: "2026-03-20", paid_at: "2026-03-14T14:00:00Z", subtotal: 2200, tax_amount: 220, discount_amount: 0, total: 2420, amount_paid: 2420, tax_name: "GST", tax_rate: 0.1 }));
  // INV-0005 for bespoke B-0001 (custom platinum wedding bands)
  await safeInsert(() => admin.from("invoices").insert({ id: "b5b5b5b5-0005-0005-0005-000000000005", tenant_id: TENANT_ID, invoice_number: "INV-0005", customer_id: "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a", reference_type: "bespoke", reference_id: "ba62301b-0b26-423a-b02e-5a48bd7034b6", status: "partial", invoice_date: "2026-03-10", due_date: "2026-04-15", subtotal: 7636.36, tax_amount: 763.64, discount_amount: 0, total: 8400, amount_paid: 2800, tax_name: "GST", tax_rate: 0.1 }));

  // Link invoices to jobs
  await safeInsert(() => admin.from("repairs").update({ invoice_id: "2c6672d1-884e-4d96-accf-b8a88ab2e27e", deposit_paid: false }).eq("id", "09686ec7-0ec5-4950-ba7f-9982c9830d43").eq("tenant_id", TENANT_ID));
  await safeInsert(() => admin.from("bespoke_jobs").update({ invoice_id: "b5b5b5b5-0005-0005-0005-000000000005", deposit_paid: false }).eq("id", "ba62301b-0b26-423a-b02e-5a48bd7034b6").eq("tenant_id", TENANT_ID));

  // INVOICE LINE ITEMS for R-0001 (INV-0001) — individual inserts
  await safeInsert(() => admin.from("invoice_line_items").insert({ tenant_id: TENANT_ID, invoice_id: "2c6672d1-884e-4d96-accf-b8a88ab2e27e", description: "Ring resizing labour", quantity: 1, unit_price: 180 }));
  await safeInsert(() => admin.from("invoice_line_items").insert({ tenant_id: TENANT_ID, invoice_id: "2c6672d1-884e-4d96-accf-b8a88ab2e27e", description: "Prong check & tighten", quantity: 1, unit_price: 90 }));
  await safeInsert(() => admin.from("invoice_line_items").insert({ tenant_id: TENANT_ID, invoice_id: "2c6672d1-884e-4d96-accf-b8a88ab2e27e", description: "Polishing & cleaning", quantity: 1, unit_price: 50 }));

  // INVOICE LINE ITEMS for B-0001 (INV-0005) — individual inserts
  await safeInsert(() => admin.from("invoice_line_items").insert({ tenant_id: TENANT_ID, invoice_id: "b5b5b5b5-0005-0005-0005-000000000005", description: "Custom platinum band", quantity: 2, unit_price: 3000 }));
  await safeInsert(() => admin.from("invoice_line_items").insert({ tenant_id: TENANT_ID, invoice_id: "b5b5b5b5-0005-0005-0005-000000000005", description: "Hand engraving (scrollwork)", quantity: 1, unit_price: 1200 }));


  // SALES
  await safeInsert(() =>
    admin.from("sales").insert([
      {
        tenant_id: TENANT_ID,
        sale_number: "S-0001",
        customer_id: "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a",
        total: 18500,
        payment_method: "card",
        status: "completed",
        sale_date: "2026-02-15T10:30:00Z",
      },
      {
        tenant_id: TENANT_ID,
        sale_number: "S-0002",
        customer_id: "7774e408-6231-4d99-bc9f-ec657456a364",
        total: 8400,
        payment_method: "card",
        status: "completed",
        sale_date: "2026-02-20T14:00:00Z",
      },
      {
        tenant_id: TENANT_ID,
        sale_number: "S-0003",
        customer_id: "9790cd8c-e746-4a2a-995f-974b61590975",
        total: 3800,
        payment_method: "cash",
        status: "completed",
        sale_date: "2026-03-01T11:15:00Z",
      },
      {
        tenant_id: TENANT_ID,
        sale_number: "S-0004",
        customer_id: "870c2497-feb4-4857-b53f-aa12ae12d41e",
        total: 2200,
        payment_method: "card",
        status: "completed",
        sale_date: "2026-03-15T09:00:00Z",
      },
      {
        tenant_id: TENANT_ID,
        sale_number: "S-0005",
        customer_id: "a436d54f-efd6-47ec-8108-e133409bd9b3",
        total: 850,
        payment_method: "cash",
        status: "completed",
        sale_date: "2026-03-15T10:30:00Z",
      },
      {
        tenant_id: TENANT_ID,
        sale_number: "S-0006",
        customer_id: "579d3617-ca48-4166-9992-2553b63b79c3",
        total: 1400,
        payment_method: "card",
        status: "completed",
        sale_date: "2026-03-15T11:00:00Z",
      },
    ])
  );

  // TASKS — operational jeweller tasks only, no test/placeholder entries
  await safeInsert(() =>
    admin.from("tasks").insert([
      {
        tenant_id: TENANT_ID,
        title: "Send David Moufarrej updated CAD renders for wedding band approval",
        status: "todo",
        priority: "high",
        due_date: "2026-03-15",
      },
      {
        tenant_id: TENANT_ID,
        title: "Confirm platinum grain delivery — B-0001 fabrication starts Monday",
        status: "todo",
        priority: "high",
        due_date: "2026-03-15",
      },
      {
        tenant_id: TENANT_ID,
        title: "Arrange collection for Lina Haddad — R-0004 pearl restring complete",
        status: "todo",
        priority: "normal",
        due_date: "2026-03-15",
      },
      {
        tenant_id: TENANT_ID,
        title: "Call Emma re: CAD approval",
        status: "todo",
        priority: "high",
        due_date: "2026-03-15",
      },
      {
        tenant_id: TENANT_ID,
        title: "Follow up INV-0003 — partial payment outstanding",
        status: "todo",
        priority: "high",
        due_date: "2026-03-15",
      },
      {
        tenant_id: TENANT_ID,
        title: "QC repair R-0005 before collection",
        status: "todo",
        priority: "normal",
        due_date: "2026-03-15",
      },
      {
        tenant_id: TENANT_ID,
        title: "Order 18k rose gold findings — running low",
        status: "todo",
        priority: "normal",
        due_date: "2026-03-16",
      },
      {
        tenant_id: TENANT_ID,
        title: "Chase GIA cert for sapphire — needed before B-0003 quote is issued",
        status: "todo",
        priority: "normal",
        due_date: "2026-03-17",
      },
      {
        tenant_id: TENANT_ID,
        title: "Update website catalogue with new stock arrivals",
        status: "todo",
        priority: "low",
        due_date: "2026-03-18",
      },
      {
        tenant_id: TENANT_ID,
        title: "Review insurance renewal — 3 store policy certificates expire end of month",
        status: "todo",
        priority: "normal",
        due_date: "2026-03-28",
      },
    ])
  );

  // PAYMENTS — individual inserts (no batched arrays)
  // INV-0001 (R-0001 repair) — initial deposit
  await safeInsert(() => admin.from("payments").insert({ tenant_id: TENANT_ID, invoice_id: "2c6672d1-884e-4d96-accf-b8a88ab2e27e", amount: 100, payment_method: "card", payment_date: "2026-03-01", notes: "Initial deposit" }));
  // INV-0005 (B-0001 bespoke) — 50% deposit
  await safeInsert(() => admin.from("payments").insert({ tenant_id: TENANT_ID, invoice_id: "b5b5b5b5-0005-0005-0005-000000000005", amount: 2800, payment_method: "card", payment_date: "2026-03-10", notes: "50% deposit" }));

  // APPRAISALS
  await safeInsert(() =>
    admin.from("appraisals").insert([
      {
        id: "86b26937-ddef-46d5-84a8-2c87fa62fe99",
        tenant_id: TENANT_ID,
        appraisal_number: "APR-0001",
        appraisal_type: "insurance",
        status: "issued",
        customer_id: "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a",
        customer_name: "David Moufarrej",
        item_name: "Diamond Solitaire Ring",
        item_description:
          "1.20ct D/VS1 round brilliant diamond in platinum 4-claw solitaire setting",
        appraised_value: 18500,
        insurance_value: 21000,
        appraisal_date: "2026-03-10",
        valid_until: "2029-03-10",
        appraiser_name: "Christine Moreau",
        appraiser_licence: "NCJV-2891",
        fee: 350,
      },
      {
        id: "797b815e-9316-4da0-ac2d-7ae49fedf166",
        tenant_id: TENANT_ID,
        appraisal_number: "APR-0002",
        appraisal_type: "estate",
        status: "completed",
        customer_id: "7774e408-6231-4d99-bc9f-ec657456a364",
        customer_name: "Emma Williams",
        item_name: "Art Deco Diamond Brooch",
        item_description:
          "Platinum Art Deco brooch with old-cut diamonds and sapphire accents. Circa 1925.",
        appraised_value: 34000,
        insurance_value: 42000,
        appraisal_date: "2026-03-08",
        valid_until: "2029-03-08",
        appraiser_name: "Christine Moreau",
        appraiser_licence: "NCJV-2891",
        fee: 650,
      },
      {
        id: "ca3f0b77-ff38-48cc-877f-6694678bcbe1",
        tenant_id: TENANT_ID,
        appraisal_number: "APR-0003",
        appraisal_type: "insurance",
        status: "in_progress",
        customer_id: "9790cd8c-e746-4a2a-995f-974b61590975",
        customer_name: "James Chen",
        item_name: "Sapphire Halo Engagement Ring",
        item_description:
          "18ct white gold sapphire halo engagement ring with Ceylon blue sapphire 1.80ct",
        appraised_value: 14500,
        insurance_value: 17000,
        appraisal_date: "2026-03-13",
        valid_until: "2029-03-13",
        appraiser_name: "Christine Moreau",
        appraiser_licence: "NCJV-2891",
        fee: 280,
      },
    ])
  );

  // MEMO_ITEMS
  await safeInsert(() =>
    admin.from("memo_items").insert([
      {
        id: "59253bec-2df4-4547-b741-540be86944e5",
        tenant_id: TENANT_ID,
        memo_number: "M-0001",
        memo_type: "memo",
        status: "active",
        customer_id: "870c2497-feb4-4857-b53f-aa12ae12d41e",
        customer_name: "Lina Haddad",
        item_name: "Pearl Strand Necklace",
        metal: "Yellow Gold",
        stone: "Freshwater Pearl",
        retail_value: 1200,
        issued_date: "2026-03-10",
        due_back_date: "2026-03-24",
      },
      {
        id: "24b52f64-9966-4000-96c8-f3be2705c36e",
        tenant_id: TENANT_ID,
        memo_number: "C-0001",
        memo_type: "consignment",
        status: "active",
        supplier_name: "Vintage Vault Estate Jewellery",
        item_name: "Victorian Mourning Brooch",
        metal: "Yellow Gold",
        stone: "Jet",
        retail_value: 3400,
        commission_rate: 25,
        issued_date: "2026-03-05",
        due_back_date: "2026-06-05",
      },
    ])
  );

  // PASSPORTS
  await safeInsert(() =>
    admin.from("passports").insert([
      {
        id: "0f092b0f-7af3-4f42-9f9f-0ff21e9c111b",
        tenant_id: TENANT_ID,
        passport_uid: "NXP-MC0001",
        title: "Diamond Solitaire Ring",
        jewellery_type: "ring",
        current_owner_name: "David Moufarrej",
        status: "active",
        is_public: true,
        verified_at: "2026-03-10T14:30:00Z",
      },
      {
        tenant_id: TENANT_ID,
        passport_uid: "NXP-MC0002",
        title: "Sapphire Halo Engagement Ring",
        jewellery_type: "ring",
        current_owner_name: "James Chen",
        status: "active",
        is_public: false,
        verified_at: "2026-03-12T10:00:00Z",
      },
      {
        tenant_id: TENANT_ID,
        passport_uid: "NXP-MC0003",
        title: "Art Deco Diamond Brooch",
        jewellery_type: "brooch",
        current_owner_name: "Emma Williams",
        status: "active",
        is_public: true,
        verified_at: "2026-03-08T09:00:00Z",
      },
    ])
  );

  // LAYBY SALE (L-0001) — Lina Haddad, Sapphire Halo Ring, $600 deposit
  let laybyId: string | undefined;
  await safeInsert(async () => {
    const { data: laybySale } = await admin
      .from("sales")
      .insert({
        tenant_id: TENANT_ID,
        sale_number: "L-0001",
        customer_id: "870c2497-feb4-4857-b53f-aa12ae12d41e",
        customer_name: "Lina Haddad",
        subtotal: 2000.00,
        discount_amount: 0,
        tax_amount: 200.00,
        total: 2200.00,
        deposit_amount: 600.00,
        amount_paid: 600.00,
        payment_method: "layby",
        status: "layby",
        sale_date: "2026-03-10",
      })
      .select("id")
      .single();
    laybyId = laybySale?.id;
  });

  if (laybyId) {
    // Find Sapphire Halo Ring inventory ID
    const { data: sapphireInv } = await admin
      .from("inventory")
      .select("id")
      .eq("tenant_id", TENANT_ID)
      .eq("sku", "SHR-002")
      .maybeSingle();

    await safeInsert(() =>
      admin.from("sale_items").insert({
        tenant_id: TENANT_ID,
        sale_id: laybyId,
        inventory_id: sapphireInv?.id ?? null,
        description: "Sapphire Halo Ring",
        quantity: 1,
        unit_price: 2000.00,
        line_total: 2000.00,
      })
    );

    await safeInsert(() =>
      admin.from("layby_payments").insert({
        tenant_id: TENANT_ID,
        sale_id: laybyId,
        amount: 600.00,
        payment_method: "cash",
        notes: "Initial deposit",
        paid_at: "2026-03-10T00:00:00Z",
      })
    );
  }

  // JOB ATTACHMENTS
  await safeInsert(() => admin.from("job_attachments").insert({ tenant_id: TENANT_ID, job_type: "repair", job_id: "09686ec7-0ec5-4950-ba7f-9982c9830d43", file_name: "ring-before.jpg", file_url: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800", caption: "Ring before repair" }));
  await safeInsert(() => admin.from("job_attachments").insert({ tenant_id: TENANT_ID, job_type: "repair", job_id: "09686ec7-0ec5-4950-ba7f-9982c9830d43", file_name: "damage-closeup.jpg", file_url: "https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=800", caption: "Prong damage closeup" }));
  await safeInsert(() => admin.from("job_attachments").insert({ tenant_id: TENANT_ID, job_type: "bespoke", job_id: "ba62301b-0b26-423a-b02e-5a48bd7034b6", file_name: "reference-band.jpg", file_url: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800", caption: "Client reference — platinum band" }));
  await safeInsert(() => admin.from("job_attachments").insert({ tenant_id: TENANT_ID, job_type: "bespoke", job_id: "ba62301b-0b26-423a-b02e-5a48bd7034b6", file_name: "sketch.jpg", file_url: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800", caption: "Designer sketch — scrollwork detail" }));

  // JOB EVENTS
  await safeInsert(() => admin.from("job_events").insert({ tenant_id: TENANT_ID, job_type: "repair", job_id: "09686ec7-0ec5-4950-ba7f-9982c9830d43", event_type: "stage_change", description: "Job received — stage set to In Progress", actor: "demo@nexpura.com" }));
  await safeInsert(() => admin.from("job_events").insert({ tenant_id: TENANT_ID, job_type: "repair", job_id: "09686ec7-0ec5-4950-ba7f-9982c9830d43", event_type: "payment", description: "Deposit of $100 recorded (card)", actor: "demo@nexpura.com" }));
  await safeInsert(() => admin.from("job_events").insert({ tenant_id: TENANT_ID, job_type: "bespoke", job_id: "ba62301b-0b26-423a-b02e-5a48bd7034b6", event_type: "stage_change", description: "Brief confirmed — job started", actor: "demo@nexpura.com" }));
  await safeInsert(() => admin.from("job_events").insert({ tenant_id: TENANT_ID, job_type: "bespoke", job_id: "ba62301b-0b26-423a-b02e-5a48bd7034b6", event_type: "payment", description: "50% deposit of $2,800 recorded (card)", actor: "demo@nexpura.com" }));

  // Redirect to sandbox entry — which redirects to /dashboard?rt=TOKEN
  return NextResponse.redirect(new URL("/sandbox", request.url));
}
