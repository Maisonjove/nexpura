import FormSection from "./FormSection";
import type { SectionProps } from "./types";

export default function RepairFormSection(props: SectionProps) {
  return <FormSection flavour="repair" {...props} />;
}
