import { CollapsibleSection, FieldLabel, Input, Select } from "./FormElements";

interface CertificatesSectionProps {
  certNumber: string;
  setCertNumber: (val: string) => void;
  gradingLab: string;
  setGradingLab: (val: string) => void;
  grade: string;
  setGrade: (val: string) => void;
  reportUrl: string;
  setReportUrl: (val: string) => void;
}

export default function CertificatesSection({
  certNumber,
  setCertNumber,
  gradingLab,
  setGradingLab,
  grade,
  setGrade,
  reportUrl,
  setReportUrl,
}: CertificatesSectionProps) {
  return (
    <CollapsibleSection title="Section 5: Certificates" badge={certNumber ? "Certified" : undefined}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <FieldLabel htmlFor="certificate_number">Certificate Number</FieldLabel>
          <Input
            id="certificate_number"
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value)}
            placeholder="e.g. GIA 1234567890"
          />
        </div>
        <div>
          <FieldLabel htmlFor="grading_lab">Grading Lab</FieldLabel>
          <Select
            id="grading_lab"
            value={gradingLab}
            onChange={(e) => setGradingLab(e.target.value)}
          >
            <option value="">Select…</option>
            <option value="GIA">GIA</option>
            <option value="IGI">IGI</option>
            <option value="AGS">AGS</option>
            <option value="HRD">HRD</option>
            <option value="Other">Other</option>
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="grade">Grade</FieldLabel>
          <Input
            id="grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="e.g. D/IF"
          />
        </div>
        <div>
          <FieldLabel htmlFor="report_url">Report URL</FieldLabel>
          <Input
            id="report_url"
            type="url"
            value={reportUrl}
            onChange={(e) => setReportUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
