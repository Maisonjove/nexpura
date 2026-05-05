import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for M-09 website-template preview iframe.
 *
 * Audit: "Website template preview iframe." Pre-fix the gallery's
 * "Preview template" button was a Next/Link doing a hard navigation
 * to /website/templates/[id]; the user lost their gallery scroll
 * position and had to back-button to return. Post-fix it opens an
 * in-page modal with an iframe loading the same preview page in
 * `?embed=1` mode (admin chrome hidden by the page).
 */

const galleryFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/website/templates/TemplateGalleryClient.tsx"),
  "utf8",
);

const detailFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/website/templates/[id]/page.tsx"),
  "utf8",
);

describe("TemplateGalleryClient — preview opens iframe modal", () => {
  it("declares a previewTemplate state", () => {
    expect(galleryFile).toMatch(/setPreviewTemplate/);
  });

  it("Preview button sets state instead of navigating via Link", () => {
    // Pre-fix Link to /website/templates/${t.id} on the Preview button is forbidden.
    // (Other Link uses in the file — the back-link to /website — are fine.)
    expect(galleryFile).toMatch(
      /onClick=\{\(\)\s*=>\s*setPreviewTemplate\(t\)\}/,
    );
    // The bad pattern would be `<Link\s+href=\{`/website/templates/\$\{t\.id\}` on
    // a "Preview template" button-style element; assert it's gone.
    const previewLink = galleryFile.match(
      /<Link[\s\S]{0,200}?href=\{`\/website\/templates\/\$\{t\.id\}`\}[\s\S]{0,200}?Preview template/,
    );
    expect(previewLink).toBeNull();
  });

  it("renders an iframe pointing at the embed-mode preview page", () => {
    expect(galleryFile).toMatch(
      /<iframe[\s\S]{0,300}src=\{`\/website\/templates\/\$\{previewTemplate\.id\}\?embed=1`\}/,
    );
  });

  it("iframe has sandbox attribute (allow-scripts + allow-same-origin only)", () => {
    expect(galleryFile).toMatch(/sandbox="allow-scripts allow-same-origin"/);
  });

  it("modal includes both Close and Use-this-template controls", () => {
    expect(galleryFile).toMatch(/Use this template/);
    expect(galleryFile).toMatch(/aria-label="Close preview"/);
  });

  it("Use-this-template inside the modal triggers handleApply", () => {
    // The CTA inside the modal must reuse the same apply flow as the
    // gallery card button — no duplicate logic that could drift.
    expect(galleryFile).toMatch(
      /onClick=\{\(\)\s*=>\s*\{[\s\S]{0,200}?setPreviewTemplate\(null\);[\s\S]{0,150}?handleApply\(t\);/,
    );
  });
});

describe("template detail page — embed mode", () => {
  it("accepts ?embed=1 search param", () => {
    expect(detailFile).toMatch(/searchParams\?:\s*Promise<\{\s*embed\?:/);
  });

  it("hides the admin chrome bar when isEmbed", () => {
    expect(detailFile).toMatch(/isEmbed/);
    expect(detailFile).toMatch(/!isEmbed\s*&&/);
  });
});
