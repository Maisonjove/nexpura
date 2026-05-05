import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import AuditDiffView from "../AuditDiffView";

/**
 * Section 4 #8 — AuditDiffView component tests.
 *
 * Replaces the truncated 3-change summary in /settings/activity
 * with a full field-by-field diff. Same component is reusable for
 * future per-entity history routes (/customers/[id]/history,
 * /inventory/[id]/history).
 */

describe("AuditDiffView", () => {
  it("renders 'Created' header when only newData is present", () => {
    const { getByText } = render(
      <AuditDiffView oldData={null} newData={{ name: "Foo", price: 100 }} />,
    );
    expect(getByText("Created")).toBeTruthy();
  });

  it("renders 'Deleted' header when only oldData is present", () => {
    const { getByText } = render(
      <AuditDiffView oldData={{ name: "Foo" }} newData={null} />,
    );
    expect(getByText("Deleted")).toBeTruthy();
  });

  it("renders changed/added/removed counts on update", () => {
    const { getByText } = render(
      <AuditDiffView
        oldData={{ name: "Foo", price: 100, color: "red" }}
        newData={{ name: "Bar", price: 100, weight: 5 }}
        compact={false}
      />,
    );
    // 1 changed (name) + 1 removed (color) + 1 added (weight) = 3
    expect(getByText(/3 changes/)).toBeTruthy();
  });

  it("renders the field key + both old and new values for changed fields", () => {
    const { container } = render(
      <AuditDiffView oldData={{ name: "Foo" }} newData={{ name: "Bar" }} />,
    );
    expect(container.textContent).toContain("Foo");
    expect(container.textContent).toContain("Bar");
    expect(container.textContent).toContain("name");
  });

  it("does NOT truncate long values (regression: pre-fix summary capped at 20 chars)", () => {
    const longValue = "x".repeat(100);
    const { container } = render(
      <AuditDiffView oldData={{ notes: "short" }} newData={{ notes: longValue }} />,
    );
    expect(container.textContent).toContain(longValue);
  });

  it("shows ALL changes (not just first 3 — regression: pre-fix summary capped at 3)", () => {
    const oldData = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`field${i}`, `old${i}`]),
    );
    const newData = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`field${i}`, `new${i}`]),
    );
    const { container } = render(<AuditDiffView oldData={oldData} newData={newData} />);
    // Every field should appear (key + old + new value)
    for (let i = 0; i < 10; i++) {
      expect(container.textContent).toContain(`field${i}`);
      expect(container.textContent).toContain(`old${i}`);
      expect(container.textContent).toContain(`new${i}`);
    }
  });

  it("hides unchanged fields by default in compact mode + offers a toggle", () => {
    const { container, queryByText } = render(
      <AuditDiffView
        oldData={{ name: "Foo", color: "red" }}
        newData={{ name: "Bar", color: "red" }}
        compact={true}
      />,
    );
    expect(container.textContent).toContain("name");
    expect(queryByText(/Show 1 unchanged field/)).toBeTruthy();
  });

  it("shows unchanged fields when compact=false", () => {
    const { container } = render(
      <AuditDiffView
        oldData={{ name: "Foo", color: "red" }}
        newData={{ name: "Bar", color: "red" }}
        compact={false}
      />,
    );
    expect(container.textContent).toContain("color");
    expect(container.textContent).toContain("red");
  });

  it("JSON-stringifies nested objects + arrays so the user can see structural changes", () => {
    const { container } = render(
      <AuditDiffView
        oldData={{ tags: ["a", "b"] }}
        newData={{ tags: ["a", "b", "c"] }}
      />,
    );
    // The nested array values render as JSON.
    expect(container.textContent).toContain('"a"');
    expect(container.textContent).toContain('"c"');
  });

  it("handles null + undefined values without crashing", () => {
    const { container } = render(
      <AuditDiffView
        oldData={{ optional: null, missing: undefined }}
        newData={{ optional: "now-set", missing: "now-set" }}
      />,
    );
    expect(container.textContent).toContain("now-set");
  });

  it("renders a no-fields placeholder when both old + new are empty objects", () => {
    const { getByText } = render(
      <AuditDiffView oldData={{}} newData={{}} />,
    );
    expect(getByText(/No fields recorded/)).toBeTruthy();
  });
});
