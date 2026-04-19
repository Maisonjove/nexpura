import { test, expect, Page } from '@playwright/test';

/**
 * Post-shell-split regression proof pass:
 *   (a) messaging smoke (3 cycles)
 *   (b) public /track smoke
 *   (c) quantify cosmetic regressions:
 *         - TopNav avatar initials fallback to 'NX' (layout no longer passes user)
 *         - LocationPicker empty window (layout no longer passes initialLocations)
 *
 * Run:
 *   BASE_URL=https://nexpura.com npx playwright test \
 *     e2e/shell-split-cosmetic-messaging.spec.ts \
 *     --project chromium --reporter=list --workers=1
 */

const BASE = process.env.BASE_URL ?? 'https://nexpura.com';
const EMAIL = process.env.TEST_EMAIL ?? 'Joeygermani11@icloud.com';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Test123456';

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password], input[name=password]').first().fill(PASSWORD);
  await page.locator('form button[type=submit]').first().click();
  await page.waitForURL(/dashboard/i, { timeout: 60000 });
}

// Avatar selector — the circular div in TopNav that shows 1-2 letter initials.
// TopNav.tsx line 297: `w-9 h-9 rounded-full bg-gradient-to-b from-[#3a3a3a]`
const AVATAR_SELECTOR = 'header div.w-9.h-9.rounded-full';

// LocationPicker button in desktop header. It shows either "All Locations"
// or a store name once locations are loaded. It's NULL'd out entirely when
// `isLoading` OR `locations.length <= 1` (see LocationPicker.tsx line 40).
const LOCATION_PICKER_SELECTOR =
  'header button:has-text("All Locations"), header button:has(svg + span)';

test.describe('shell-split cosmetic + smoke', () => {
  test.setTimeout(10 * 60 * 1000);

  test('cosmetic + messaging + tracking proof', async ({ browser }) => {
    const report: {
      avatar: {
        nxFirstSeenMs: number | null;
        realInitialsSeenMs: number | null;
        nxPersistedMs: number | null;
        finalText: string | null;
        stayedNX: boolean;
      };
      locationPicker: {
        pageVisibleAtMs: number | null;
        pickerPopulatedAtMs: number | null;
        emptyWindowMs: number | null;
        finalText: string | null;
        neverRendered: boolean;
      };
      messaging: { cycles: number; passed: number; failures: string[] };
      tracking: { ok: boolean; notes: string };
    } = {
      avatar: {
        nxFirstSeenMs: null,
        realInitialsSeenMs: null,
        nxPersistedMs: null,
        finalText: null,
        stayedNX: false,
      },
      locationPicker: {
        pageVisibleAtMs: null,
        pickerPopulatedAtMs: null,
        emptyWindowMs: null,
        finalText: null,
        neverRendered: false,
      },
      messaging: { cycles: 3, passed: 0, failures: [] },
      tracking: { ok: false, notes: '' },
    };

    // === (c) Cosmetic — cold hard-nav to /dashboard ==========================
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ctx.clearCookies();
    await login(page);

    // Hard nav to dashboard with the session already established.
    const navStart = Date.now();
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'commit', timeout: 60000 });

    // Avatar: poll text content over time.
    const avatarLocator = page.locator(AVATAR_SELECTOR).first();

    // Wait for the avatar element to exist in the DOM (it's in the static shell,
    // so this should be near-instant after commit).
    try {
      await avatarLocator.waitFor({ state: 'attached', timeout: 15000 });
    } catch {
      // TopNav not rendered — shouldn't happen but handle gracefully.
    }

    // Poll the avatar text for up to 10s to detect any transition away from 'NX'.
    const pollDeadline = Date.now() + 10_000;
    let nxFirstSeenAt: number | null = null;
    let realInitialsFirstSeenAt: number | null = null;
    let lastText: string | null = null;

    while (Date.now() < pollDeadline) {
      try {
        const txt = (await avatarLocator.textContent({ timeout: 500 }))?.trim() ?? '';
        lastText = txt;
        if (txt === 'NX' && nxFirstSeenAt === null) {
          nxFirstSeenAt = Date.now() - navStart;
        }
        if (txt && txt !== 'NX' && realInitialsFirstSeenAt === null) {
          realInitialsFirstSeenAt = Date.now() - navStart;
          break;
        }
      } catch {}
      await page.waitForTimeout(100);
    }

    report.avatar.nxFirstSeenMs = nxFirstSeenAt;
    report.avatar.realInitialsSeenMs = realInitialsFirstSeenAt;
    report.avatar.finalText = lastText;
    report.avatar.stayedNX = lastText === 'NX' && realInitialsFirstSeenAt === null;
    report.avatar.nxPersistedMs =
      report.avatar.stayedNX
        ? Date.now() - navStart - (nxFirstSeenAt ?? 0)
        : realInitialsFirstSeenAt !== null && nxFirstSeenAt !== null
          ? realInitialsFirstSeenAt - nxFirstSeenAt
          : null;

    // === LocationPicker window ==============================================
    // The picker component returns null while isLoading=true and when
    // locations.length <= 1. So "empty window" means either:
    //   - no picker button rendered yet, or
    //   - button rendered with its default text once locations arrive.
    // We anchor "page visible" to the main h1/heading in the dashboard.
    const mainVisible = page.locator('main h1, main h2').first();
    try {
      await mainVisible.waitFor({ state: 'visible', timeout: 20_000 });
      report.locationPicker.pageVisibleAtMs = Date.now() - navStart;
    } catch {}

    // Poll for the picker button to appear with location text.
    const pickerDeadline = Date.now() + 10_000;
    let pickerText: string | null = null;
    while (Date.now() < pickerDeadline) {
      const pickerButton = page
        .locator('header button')
        .filter({ hasText: /All Locations|Select Store/ })
        .first();
      if ((await pickerButton.count()) > 0) {
        try {
          pickerText = (await pickerButton.textContent({ timeout: 500 }))?.trim() ?? '';
          if (pickerText) {
            report.locationPicker.pickerPopulatedAtMs = Date.now() - navStart;
            break;
          }
        } catch {}
      }
      await page.waitForTimeout(100);
    }

    report.locationPicker.finalText = pickerText;
    // If picker never rendered in 10s, either the tenant has 0-1 locations
    // (component returns null by design) OR the fetch hasn't fired. Flag so
    // we can interpret.
    report.locationPicker.neverRendered = pickerText === null;

    if (
      report.locationPicker.pageVisibleAtMs !== null &&
      report.locationPicker.pickerPopulatedAtMs !== null
    ) {
      report.locationPicker.emptyWindowMs =
        report.locationPicker.pickerPopulatedAtMs - report.locationPicker.pageVisibleAtMs;
    }

    // === (a) Messaging smoke — 3 cycles ======================================
    // Navigate to /repairs, click first row, find composer textarea, post msg,
    // reload, verify it persists. Repeat 3×.
    await page.goto(`${BASE}/repairs`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Rows are TableRow elements (<tr>) inside a <tbody>, rendered by
    // RepairRow.tsx. Wait for at least one row to appear.
    let repairDetailUrl: string | null = null;
    try {
      // Wait for table body rows to render.
      await page.locator('main tbody tr').first().waitFor({ state: 'visible', timeout: 30000 });
      const firstRow = page.locator('main tbody tr').first();
      await firstRow.click();
      await page.waitForURL(/\/repairs\/[^/]+$/, { timeout: 30000 });
      repairDetailUrl = page.url();
    } catch (e) {
      // Try pipeline view or list card fallbacks.
      try {
        const anyCard = page
          .locator('main a[href*="/repairs/"], main [data-repair-id], main [class*="cursor-pointer"]')
          .first();
        await anyCard.waitFor({ state: 'visible', timeout: 15000 });
        await anyCard.click();
        await page.waitForURL(/\/repairs\/[^/]+$/, { timeout: 30000 });
        repairDetailUrl = page.url();
      } catch (e2) {
        report.messaging.failures.push(
          `could not open a repair detail: ${String(e).slice(0, 160)} // fallback: ${String(e2).slice(0, 160)}`,
        );
      }
    }

    if (repairDetailUrl) {
      for (let i = 1; i <= 3; i++) {
        const msg = `proof-pass-test-${i}`;
        try {
          // Scroll the message composer into view. It's inside OrderMessagesPanel
          // and has placeholder "Reply to the customer…".
          const composer = page
            .locator('textarea[placeholder*="Reply to the customer"]')
            .first();
          await composer.waitFor({ state: 'visible', timeout: 15000 });
          await composer.fill(msg);

          // Submit — the form has a button "Reply" (or "Sending…" while pending).
          const replyBtn = page.locator('button[type=submit]').filter({ hasText: /^Reply$|^Sending/ }).first();
          await replyBtn.click();

          // Wait for the optimistic message to hit the DOM.
          await page
            .locator('text=' + msg)
            .first()
            .waitFor({ state: 'visible', timeout: 15000 });

          // Wait for the server round-trip to complete — the button flips
          // back from "Sending…" to "Reply" via useTransition's pending flag.
          // This guards against reloading before the insert hit Postgres.
          await page
            .locator('button[type=submit]:has-text("Sending")')
            .waitFor({ state: 'hidden', timeout: 20000 })
            .catch(() => {});
          // Belt-and-braces: wait for any pending network.
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

          // Reload and verify the message persisted server-side.
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
          await page
            .locator('text=' + msg)
            .first()
            .waitFor({ state: 'visible', timeout: 20000 });

          report.messaging.passed += 1;
        } catch (e) {
          report.messaging.failures.push(`cycle ${i}: ${String(e).slice(0, 200)}`);
        }
      }
    }

    // === (b) Tracking smoke ==================================================
    try {
      await page.goto(`${BASE}/track`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      // Track page has an <input id="tracking"> and submit button.
      const trackInput = page.locator('input#tracking, input[placeholder*="RPR-"]').first();
      await trackInput.waitFor({ state: 'visible', timeout: 15000 });
      const submitBtn = page.locator('button[type=submit]:has-text("Track Order")').first();
      await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
      report.tracking.ok = true;
      report.tracking.notes = 'input + submit visible';
    } catch (e) {
      report.tracking.ok = false;
      report.tracking.notes = String(e).slice(0, 200);
    }

    await ctx.close();

    // === Emit the report ====================================================
    console.log('\n===== SHELL-SPLIT COSMETIC + SMOKE REPORT =====');
    console.log(JSON.stringify(report, null, 2));
    console.log('================================================\n');

    // Lightweight assertions so test status reflects the smoke result.
    expect(report.tracking.ok, `tracking: ${report.tracking.notes}`).toBe(true);
    expect(
      report.messaging.passed,
      `messaging: ${report.messaging.failures.join(' | ')}`,
    ).toBeGreaterThanOrEqual(1);
  });
});
