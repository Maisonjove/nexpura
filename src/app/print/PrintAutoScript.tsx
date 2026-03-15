"use client";

import { useEffect } from "react";

export function PrintAutoScript() {
  useEffect(() => {
    window.print();
  }, []);
  return null;
}

export function CloseButton() {
  return (
    <button
      onClick={() => window.close()}
      className="no-print"
      style={{ position: "fixed", top: 12, right: 12, padding: "6px 14px", background: "#e5e7eb", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer", fontSize: 12, zIndex: 1000 }}
    >
      Close
    </button>
  );
}
