// Shared constants for Intake module

export const JEWELLERY_TYPES = [
  "Ring",
  "Bracelet",
  "Necklace",
  "Earrings",
  "Pendant",
  "Watch",
  "Brooch",
  "Bangle",
  "Chain",
];

export const METAL_TYPES = [
  { value: "gold", label: "Gold" },
  { value: "platinum", label: "Platinum" },
  { value: "silver", label: "Silver" },
  { value: "rose_gold", label: "Rose Gold" },
  { value: "palladium", label: "Palladium" },
  { value: "white_gold", label: "White Gold" },
];

export const METAL_PURITIES = [
  "9ct",
  "10ct",
  "14ct",
  "18ct",
  "22ct",
  "24ct",
  "925 Silver",
  "950 Platinum",
];

export const METAL_COLOURS = [
  { value: "yellow", label: "Yellow Gold" },
  { value: "white", label: "White Gold" },
  { value: "rose", label: "Rose Gold" },
  { value: "platinum", label: "Platinum" },
];

export const RING_SIZES = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

export const STONE_SHAPES = [
  "Round",
  "Oval",
  "Cushion",
  "Emerald",
  "Princess",
  "Pear",
  "Marquise",
  "Asscher",
  "Radiant",

];

export const SETTING_STYLES = [
  "Solitaire",
  "Halo",
  "Pavé",
  "Channel Set",
  "Bezel",
  "Three-stone",
  "Tension",
  "Cluster",

];

export const REPAIR_ISSUES = [
  "Ring resize",
  "Stone replacement",
  "Clasp repair",
  "Chain repair",
  "Prong re-tipping",
  "Polishing & cleaning",
  "Rhodium plating",
  "Engraving",
  "Stone setting",
  "Soldering",
  "General repair",

];

export const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-stone-100 text-stone-600" },
  { value: "normal", label: "Normal", color: "bg-blue-50 text-blue-600" },
  { value: "high", label: "High", color: "bg-amber-50 text-amber-700" },
  { value: "urgent", label: "Urgent", color: "bg-red-50 text-red-600" },
];

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "eftpos", label: "Eftpos" },
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "amex", label: "American Express" },
  { value: "discover", label: "Discover" },
  { value: "cheque", label: "Cheque" },
  { value: "gift_voucher", label: "Gift Voucher" },
  { value: "customer_credit", label: "Customer Credit" },
  { value: "website", label: "Website Payments" },
  { value: "other", label: "Other" },
];

export const COLLECTION_STATUSES = [
  { value: "awaiting", label: "Awaiting completion" },
  { value: "ready", label: "Ready for collection" },
  { value: "collected", label: "Collected" },
];

export const DESIGN_SOURCES = [
  "Customer's sketch",
  "Photo reference",
  "Existing piece modification",
  "Our design",
  "CAD provided by customer",
  "TBD with designer",
];
