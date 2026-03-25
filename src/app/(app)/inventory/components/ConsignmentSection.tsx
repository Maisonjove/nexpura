import { CollapsibleSection, FieldLabel, Input } from "./FormElements";

interface ConsignmentSectionProps {
  status: string;
  consignorName: string;
  setConsignorName: (val: string) => void;
  consignorContact: string;
  setConsignorContact: (val: string) => void;
  consignmentStart: string;
  setConsignmentStart: (val: string) => void;
  consignmentEnd: string;
  setConsignmentEnd: (val: string) => void;
  consignmentCommPct: string;
  setConsignmentCommPct: (val: string) => void;
}

export default function ConsignmentSection({
  status,
  consignorName,
  setConsignorName,
  consignorContact,
  setConsignorContact,
  consignmentStart,
  setConsignmentStart,
  consignmentEnd,
  setConsignmentEnd,
  consignmentCommPct,
  setConsignmentCommPct,
}: ConsignmentSectionProps) {
  if (status !== "consignment" && !consignorName) {
    return null;
  }

  return (
    <CollapsibleSection title="Section 7: Consignment" defaultOpen={status === "consignment"}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel htmlFor="consignor_name">Consignor Name</FieldLabel>
          <Input
            id="consignor_name"
            value={consignorName}
            onChange={(e) => setConsignorName(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="consignor_contact">Consignor Contact</FieldLabel>
          <Input
            id="consignor_contact"
            value={consignorContact}
            onChange={(e) => setConsignorContact(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="consignment_start_date">Start Date</FieldLabel>
          <Input
            id="consignment_start_date"
            type="date"
            value={consignmentStart}
            onChange={(e) => setConsignmentStart(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="consignment_end_date">End Date</FieldLabel>
          <Input
            id="consignment_end_date"
            type="date"
            value={consignmentEnd}
            onChange={(e) => setConsignmentEnd(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="consignment_commission_pct">Commission (%)</FieldLabel>
          <Input
            id="consignment_commission_pct"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={consignmentCommPct}
            onChange={(e) => setConsignmentCommPct(e.target.value)}
            placeholder="15"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
