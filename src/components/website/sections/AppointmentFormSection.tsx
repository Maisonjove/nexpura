import FormSection from "./FormSection";
import type { SectionProps } from "./types";

export default function AppointmentFormSection(props: SectionProps) {
  return <FormSection flavour="appointment" {...props} />;
}
