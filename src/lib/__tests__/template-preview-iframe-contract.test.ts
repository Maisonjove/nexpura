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
 * in-page modal with an iframe loading a preview page sandboxed from
 * the admin shell.
 *
 * R6-F14 (item 16) update: the iframe now points at the (public)
 * embed-only route /website/templates/[id]/embed instead of the
 * (app) route with ?embed=1. The previous URL still rendered the
 * (app)/layout.tsx admin chrome around the iframe content because
 * route-group-level layouts can't read searchParams. Moving the
 * embed view into (public) — which has no layout — gives a clean
 * customer-facing render. The standalone (app)/website/templates/[id]
 * full-page preview keeps its admin chrome unchanged.
 */

const galleryFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/website/templates/TemplateGalleryClient.tsx"),
  "utf8",
);

const detailFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/website/templates/[id]/page.tsx"),
  "utf8",
);

const embedFile = fs.readFileSync(
  path.resolve(__dirname, "../../app/(public)/website/templates/[id]/embed/page.tsx"),
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

  it("renders an iframe pointing at the (public) embed-only preview route", () => {
    // R6-F14 (item 16): src now targets the (public) embed route, NOT
    // /website/templates/[id]?embed=1 — the latter inherited the
    // (app) admin shell.
    expect(galleryFile).toMatch(
      /<iframe[\s\S]{0,400}src=\{`\/website\/templates\/\$\{previewTemplate\.id\}\/embed`\}/,
    );
    // And explicitly assert the old admin-leaking URL is gone.
    expect(galleryFile).not.toMatch(
      /src=\{`\/website\/templates\/\$\{previewTemplate\.id\}\?embed=1`\}/,
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

describe("template detail page — embed mode (legacy in-page admin bar gate)", () => {
  it("accepts ?embed=1 search param", () => {
    expect(detailFile).toMatch(/searchParams\?:\s*Promise<\{\s*embed\?:/);
  });

  it("hides the admin chrome bar when isEmbed", () => {
    expect(detailFile).toMatch(/isEmbed/);
    expect(detailFile).toMatch(/!isEmbed\s*&&/);
  });
});

describe("(public) embed preview page — R6-F14 (item 16)", () => {
  it("lives under (public)/website/templates/[id]/embed (file exists)", () => {
    // The fs.readFileSync call at the top of this file already throws
    // on missing path; this assertion documents the contract.
    expect(embedFile.length).toBeGreaterThan(0);
  });

  it("renders the same template content as the (app) detail page", () => {
    // Body of the preview must include the renderer + chrome
    // components — same surface as the standalone preview, just
    // without the admin shell wrapper.
    expect(embedFile).toMatch(/SectionRenderer/);
    expect(embedFile).toMatch(/TemplateNav/);
    expect(embedFile).toMatch(/TemplateFooter/);
  });

  it("does NOT render an in-page admin bar (no ←/Use-this Link elements)", () => {
    // The admin bar lived inside the (app) detail page's `!isEmbed`
    // block. The (public) page has no admin context at all — the
    // iframe modal in TemplateGalleryClient owns close + use-this
    // controls externally. Match only on actual JSX elements (not
    // comment text) by anchoring on the Link tag.
    expect(embedFile).not.toMatch(/<Link[\s\S]{0,200}All templates/);
    expect(embedFile).not.toMatch(/<Link[\s\S]{0,200}Use this/);
    // And the page must not import Link at all — the only reason to
    // pull it in would be one of the admin-bar links.
    expect(embedFile).not.toMatch(/from\s+["']next\/link["']/);
  });

  it("opts out of search-engine indexing (this URL is iframe-only)", () => {
    expect(embedFile).toMatch(/robots:\s*\{\s*index:\s*false/);
  });
});
