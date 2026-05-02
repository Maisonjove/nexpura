import FormSection from "./FormSection";
import type { SectionProps } from "./types";

export default function ContactFormSection(props: SectionProps) {
  return <FormSection flavour="contact" {...props} />;
}
