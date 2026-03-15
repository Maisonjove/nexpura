"use client"

import React from "react"
import { formatCurrency } from "@/lib/format-currency"

export interface StockTagTemplate {
  id: string
  name: string
  width_mm: number
  height_mm: number
  orientation: "landscape" | "portrait"
  show_price: boolean
  show_sku: boolean
  show_barcode: boolean
  show_qr: boolean
  show_metal: boolean
  show_stone: boolean
  show_weight: boolean
  show_store_name: boolean
  font_size_name: number
  font_size_details: number
  font_size_price: number
}

export interface StockTagItem {
  id: string
  name: string
  sku: string | null
  retail_price: number
  metal_type: string | null
  stone_type: string | null
  metal_weight_grams: number | null
  barcode_value: string | null
}

interface StockTagProps {
  item: StockTagItem
  template: StockTagTemplate
  tenantName: string
}

const MM_TO_PX = 3.7795275591 // 1mm at 96dpi

// Simple Code128-like barcode renderer (simplified visual representation)
function SimpleBarcodeLines({ value, width, height }: { value: string; width: number; height: number }) {
  // Generate a deterministic pattern from the string
  const bars: number[] = []
  let seed = 0
  for (let i = 0; i < value.length; i++) {
    seed = (seed * 31 + value.charCodeAt(i)) & 0xFFFFFF
  }

  // Guard bars + data + guard
  bars.push(1, 0, 1) // start guard
  for (let i = 0; i < value.length * 3 + 6; i++) {
    seed = (seed * 1103515245 + 12345) & 0xFFFFFF
    bars.push(seed % 3 === 0 ? 2 : 1)
  }
  bars.push(1, 0, 1) // end guard

  const totalUnits = bars.reduce((a, b) => a + b, 0)
  const unitWidth = width / totalUnits

  let x = 0
  const rects: React.ReactElement[] = []

  bars.forEach((units, i) => {
    const barWidth = units * unitWidth
    if (i % 2 === 0) {
      rects.push(
        <rect key={i} x={x} y={0} width={barWidth} height={height} fill="#000000" />
      )
    }
    x += barWidth
  })

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      {rects}
    </svg>
  )
}

export default function StockTag({ item, template, tenantName }: StockTagProps) {
  const widthPx = template.width_mm * MM_TO_PX
  const heightPx = template.height_mm * MM_TO_PX

  const tagStyle: React.CSSProperties = {
    width: `${widthPx}px`,
    height: `${heightPx}px`,
    border: "1px solid #000",
    backgroundColor: "#fff",
    padding: "3px 4px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    overflow: "hidden",
    fontFamily: "Arial, Helvetica, sans-serif",
    position: "relative",
  }

  const barcodeHeight = template.show_barcode ? Math.min(heightPx * 0.25, 18) : 0
  const barcodeWidth = widthPx - 8

  return (
    <>
      <style>{`
        @media print {
          .stock-tag-print-wrapper * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="stock-tag-print-wrapper" style={tagStyle}>
        {/* Store name */}
        {template.show_store_name && (
          <div style={{
            fontSize: `${template.font_size_details - 1}px`,
            fontWeight: "700",
            textAlign: "center",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#000",
            lineHeight: 1,
            marginBottom: "1px",
          }}>
            {tenantName}
          </div>
        )}

        {/* Item name */}
        <div style={{
          fontSize: `${template.font_size_name}px`,
          fontWeight: "600",
          color: "#000",
          lineHeight: 1.1,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}>
          {item.name}
        </div>

        {/* Details row */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" as const }}>
          {template.show_sku && item.sku && (
            <span style={{ fontSize: `${template.font_size_details}px`, color: "#555", fontFamily: "monospace" }}>
              {item.sku}
            </span>
          )}
          {template.show_metal && item.metal_type && (
            <span style={{ fontSize: `${template.font_size_details}px`, color: "#333", textTransform: "capitalize" as const }}>
              {item.metal_type}
            </span>
          )}
          {template.show_stone && item.stone_type && (
            <span style={{ fontSize: `${template.font_size_details}px`, color: "#333", textTransform: "capitalize" as const }}>
              {item.stone_type}
            </span>
          )}
          {template.show_weight && item.metal_weight_grams && (
            <span style={{ fontSize: `${template.font_size_details}px`, color: "#333" }}>
              {item.metal_weight_grams}g
            </span>
          )}
        </div>

        {/* Price */}
        {template.show_price && (
          <div style={{
            fontSize: `${template.font_size_price}px`,
            fontWeight: "700",
            color: "#000",
            lineHeight: 1,
          }}>
            {formatCurrency(item.retail_price, "AUD")}
          </div>
        )}

        {/* Barcode */}
        {template.show_barcode && item.barcode_value && (
          <div style={{ marginTop: "2px" }}>
            <SimpleBarcodeLines
              value={item.barcode_value}
              width={barcodeWidth}
              height={barcodeHeight}
            />
            <div style={{
              fontSize: "5px",
              textAlign: "center",
              fontFamily: "monospace",
              color: "#000",
              letterSpacing: "0.05em",
              marginTop: "1px",
            }}>
              {item.barcode_value}
            </div>
          </div>
        )}

        {/* QR placeholder */}
        {template.show_qr && (
          <div style={{
            width: "20px",
            height: "20px",
            border: "1px solid #000",
            fontSize: "5px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
            position: "absolute",
            bottom: "3px",
            right: "3px",
          }}>
            QR
          </div>
        )}
      </div>
    </>
  )
}
