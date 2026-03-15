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

  // 1. payments
  await safeDelete(() => admin.from("payments").delete().eq("tenant_id", TENANT_ID));

  // 2. invoice_line_items (via invoice join)
  const { data: invoiceRows } = await admin
    .from("invoices")
    .select("id")
    .eq("tenant_id", TENANT_ID);
  const invoiceIds = invoiceRows?.map((i: { id: string }) => i.id) ?? [];
  if (invoiceIds.length > 0) {
    await safeDelete(() =>
      admin.from("invoice_line_items").delete().in("invoice_id", invoiceIds)
    );
  }

  // 3. invoices
  await safeDelete(() => admin.from("invoices").delete().eq("tenant_id", TENANT_ID));

  // 4. sale_items (via sales join)
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

  // 5. sales
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

  // 15. customers
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

  // INVENTORY
  await safeInsert(() =>
    admin.from("inventory").insert([
      {
        id: "67940b89-90ed-43b7-96a5-7bfc14d1ed79",
        tenant_id: TENANT_ID,
        sku: "DSR-001",
        name: "Diamond Solitaire Ring",
        item_type: "jewellery",
        jewellery_type: "ring",
        metal_type: "platinum",
        metal_purity: "950",
        stone_type: "diamond",
        stone_carat: 1.2,
        stone_colour: "D",
        stone_clarity: "VS1",
        ring_size: "N",
        retail_price: 18500,
        quantity: 1,
        status: "active",
        description:
          "Classic 4-claw platinum solitaire with 1.20ct D/VS1 round brilliant diamond. GIA certified.",
      },
      {
        tenant_id: TENANT_ID,
        sku: "SHR-002",
        name: "Sapphire Halo Ring",
        item_type: "jewellery",
        jewellery_type: "ring",
        metal_type: "white gold",
        metal_purity: "18ct",
        stone_type: "sapphire",
        stone_carat: 1.8,
        retail_price: 12800,
        ring_size: "L",
        quantity: 1,
        status: "active",
        description: "18ct white gold sapphire halo ring with diamond surround.",
      },
      {
        tenant_id: TENANT_ID,
        sku: "GDB-003",
        name: "Gold Diamond Bracelet",
        item_type: "jewellery",
        jewellery_type: "bracelet",
        metal_type: "yellow gold",
        metal_purity: "18ct",
        stone_type: "diamond",
        retail_price: 8400,
        quantity: 1,
        status: "active",
        description: "18ct yellow gold tennis bracelet with 3.5ct total diamond weight.",
      },
      {
        tenant_id: TENANT_ID,
        sku: "PEN-004",
        name: "Pearl Pendant Necklace",
        item_type: "jewellery",
        jewellery_type: "necklace",
        metal_type: "yellow gold",
        metal_purity: "18ct",
        retail_price: 2200,
        quantity: 2,
        status: "active",
        description: "18ct yellow gold freshwater pearl pendant on 45cm chain.",
      },
      {
        tenant_id: TENANT_ID,
        sku: "EDD-005",
        name: "Emerald Drop Earrings",
        item_type: "jewellery",
        jewellery_type: "earrings",
        metal_type: "white gold",
        metal_purity: "18ct",
        stone_type: "emerald",
        retail_price: 5600,
        quantity: 1,
        status: "active",
        description:
          "18ct white gold Colombian emerald drop earrings with diamond halos.",
      },
      {
        tenant_id: TENANT_ID,
        sku: "RGC-006",
        name: "Rose Gold Chain",
        item_type: "jewellery",
        jewellery_type: "chain",
        metal_type: "rose gold",
        metal_purity: "18ct",
        metal_weight_grams: 8.5,
        retail_price: 1400,
        quantity: 3,
        status: "active",
        description: "18ct rose gold fine curb chain, 50cm.",
      },
      {
        tenant_id: TENANT_ID,
        sku: "DWB-007",
        name: "Diamond Wedding Band",
        item_type: "jewellery",
        jewellery_type: "ring",
        metal_type: "platinum",
        metal_purity: "950",
        stone_type: "diamond",
        retail_price: 4800,
        ring_size: "M",
        quantity: 2,
        status: "active",
        description: "Platinum channel-set diamond wedding band. 0.50ct total weight.",
      },
      {
        tenant_id: TENANT_ID,
        sku: "VBR-008",
        name: "Vintage Brooch",
        item_type: "jewellery",
        jewellery_type: "brooch",
        metal_type: "yellow gold",
        metal_purity: "9ct",
        retail_price: 950,
        quantity: 1,
        status: "active",
        description:
          "9ct gold Art Nouveau brooch with seed pearls and rose-cut diamonds. Circa 1910.",
      },
      {
        tenant_id: TENANT_ID,
        sku: "MEN-009",
        name: "Men's Signet Ring",
        item_type: "jewellery",
        jewellery_type: "ring",
        metal_type: "yellow gold",
        metal_purity: "18ct",
        ring_size: "T",
        retail_price: 3200,
        quantity: 1,
        status: "active",
        description: "18ct yellow gold men's signet ring with flat top.",
      },
      {
        tenant_id: TENANT_ID,
        sku: "AQP-010",
        name: "Aquamarine Pendant",
        item_type: "jewellery",
        jewellery_type: "pendant",
        metal_type: "white gold",
        metal_purity: "18ct",
        stone_type: "aquamarine",
        stone_carat: 3.5,
        retail_price: 3800,
        quantity: 1,
        status: "active",
        description:
          "18ct white gold aquamarine and diamond pendant. Oval aquamarine 3.50ct.",
      },
    ])
  );

  // REPAIRS
  await safeInsert(() =>
    admin.from("repairs").insert([
      {
        id: "3d4480d1-47cc-407c-99d9-9462d93f7eca",
        tenant_id: TENANT_ID,
        repair_number: "R-0001",
        customer_id: "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a",
        description:
          "Resize platinum solitaire ring from size L to N. Check prong integrity.",
        stage: "in_progress",
        priority: "normal",
        quoted_price: 320,
        deposit_amount: 100,
        deposit_paid: true,
        due_date: "2026-03-20",
      },
      {
        tenant_id: TENANT_ID,
        repair_number: "R-0002",
        customer_id: "7774e408-6231-4d99-bc9f-ec657456a364",
        description:
          "Polish and rhodium plate white gold bracelet. Replace broken clasp.",
        stage: "quoted",
        priority: "normal",
        quoted_price: 180,
        deposit_paid: false,
        due_date: "2026-03-25",
      },
      {
        tenant_id: TENANT_ID,
        repair_number: "R-0003",
        customer_id: "9790cd8c-e746-4a2a-995f-974b61590975",
        description:
          "Set 3 replacement diamonds in pendant. Stones provided by client.",
        stage: "assessed",
        priority: "high",
        quoted_price: 450,
        deposit_paid: false,
        due_date: "2026-03-22",
      },
      {
        tenant_id: TENANT_ID,
        repair_number: "R-0004",
        customer_id: "870c2497-feb4-4857-b53f-aa12ae12d41e",
        description:
          "Restring pearl necklace on silk with gold knotting. 48 pearls.",
        stage: "ready",
        priority: "normal",
        quoted_price: 240,
        final_price: 240,
        deposit_amount: 80,
        deposit_paid: true,
        due_date: "2026-03-15",
      },
      {
        tenant_id: TENANT_ID,
        repair_number: "R-0005",
        customer_id: "a436d54f-efd6-47ec-8108-e133409bd9b3",
        description:
          "Full service and clean of vintage brooch. Tighten loose setting.",
        stage: "intake",
        priority: "low",
        quoted_price: 150,
        deposit_paid: false,
      },
    ])
  );

  // BESPOKE JOBS
  await safeInsert(() =>
    admin.from("bespoke_jobs").insert([
      {
        id: "4db9a53d-5300-40f6-96fb-e89ccb3ebee3",
        tenant_id: TENANT_ID,
        job_number: "B-0001",
        customer_id: "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a",
        title: "Custom Platinum Wedding Bands",
        description: "Matching platinum wedding bands with hand-engraved scrollwork.",
        stage: "in_progress",
        priority: "high",
        quoted_price: 8400,
        deposit_amount: 2800,
        deposit_received: true,
        due_date: "2026-04-15",
      },
      {
        tenant_id: TENANT_ID,
        job_number: "B-0002",
        customer_id: "7774e408-6231-4d99-bc9f-ec657456a364",
        title: "Art Deco Inspired Cocktail Ring",
        description:
          "18ct white gold cocktail ring with central aquamarine and geometric diamond surround.",
        stage: "assessed",
        priority: "normal",
        quoted_price: 5200,
        deposit_received: false,
        due_date: "2026-05-01",
      },
      {
        tenant_id: TENANT_ID,
        job_number: "B-0003",
        customer_id: "9790cd8c-e746-4a2a-995f-974b61590975",
        title: "Sapphire Halo Engagement Ring",
        description:
          "18ct white gold sapphire halo engagement ring. Ceylon blue sapphire.",
        stage: "quoted",
        priority: "urgent",
        quoted_price: 9800,
        deposit_amount: 3000,
        deposit_received: true,
        due_date: "2026-03-30",
      },
    ])
  );

  // INVOICES
  await safeInsert(() =>
    admin.from("invoices").insert([
      {
        id: "2c6672d1-884e-4d96-accf-b8a88ab2e27e",
        tenant_id: TENANT_ID,
        invoice_number: "INV-0001",
        customer_id: "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a",
        status: "paid",
        subtotal: 18500,
        tax: 1850,
        total: 20350,
        amount_paid: 20350,
        due_date: "2026-03-10",
        issued_date: "2026-03-01",
      },
      {
        tenant_id: TENANT_ID,
        invoice_number: "INV-0002",
        customer_id: "7774e408-6231-4d99-bc9f-ec657456a364",
        status: "unpaid",
        subtotal: 8400,
        tax: 840,
        total: 9240,
        amount_paid: 0,
        due_date: "2026-03-31",
        issued_date: "2026-03-05",
      },
      {
        tenant_id: TENANT_ID,
        invoice_number: "INV-0003",
        customer_id: "9790cd8c-e746-4a2a-995f-974b61590975",
        status: "partial",
        subtotal: 5600,
        tax: 560,
        total: 6160,
        amount_paid: 3000,
        due_date: "2026-03-08",
        issued_date: "2026-02-25",
      },
      {
        tenant_id: TENANT_ID,
        invoice_number: "INV-0004",
        customer_id: "870c2497-feb4-4857-b53f-aa12ae12d41e",
        status: "paid",
        subtotal: 2200,
        tax: 220,
        total: 2420,
        amount_paid: 2420,
        due_date: "2026-03-20",
        issued_date: "2026-03-12",
      },
    ])
  );

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

  // Redirect to sandbox entry — which redirects to /dashboard?rt=TOKEN
  return NextResponse.redirect(new URL("/sandbox", request.url));
}
