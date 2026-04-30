import FormSection from "./FormSection";
import type { SectionProps } from "./types";

export default function EnquiryFormSection(props: SectionProps) {
  return <FormSection flavour="enquiry" {...props} />;
}
