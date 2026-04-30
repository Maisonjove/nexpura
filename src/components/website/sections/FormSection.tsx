import type { SectionProps } from "./types";
import { getString, styleOverrides } from "./types";

type Field = {
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "date" | "select";
  placeholder?: string;
  options?: string[];
  fullWidth?: boolean;
};

type FormFlavour = "contact" | "enquiry" | "repair" | "appointment";

const FIELDS: Record<FormFlavour, Field[]> = {
  contact: [
    { label: "Your name", type: "text" },
    { label: "Email", type: "email" },
    { label: "Phone", type: "tel" },
    { label: "Message", type: "textarea", fullWidth: true },
  ],
  enquiry: [
    { label: "Your name", type: "text" },
    { label: "Email", type: "email" },
    { label: "Phone", type: "tel" },
    { label: "Budget (optional)", type: "text" },
    {
      label: "What you have in mind",
      type: "textarea",
      placeholder: "Tell us a little — pieces you've seen, stones you like, when you'd hope to wear it",
      fullWidth: true,
    },
  ],
  repair: [
    { label: "Your name", type: "text" },
    { label: "Email", type: "email" },
    { label: "Phone", type: "tel" },
    {
      label: "Type of repair",
      type: "select",
      options: ["Resizing", "Claw re-tipping", "Soldering", "Stone setting", "Restringing", "Cleaning", "Valuation", "Other"],
    },
    {
      label: "Describe the piece and what's needed",
      type: "textarea",
      fullWidth: true,
    },
  ],
  appointment: [
    { label: "Your name", type: "text" },
    { label: "Email", type: "email" },
    { label: "Phone", type: "tel" },
    { label: "Preferred date", type: "date" },
    {
      label: "What you'd like to look at",
      type: "textarea",
      fullWidth: true,
    },
  ],
};

const DEFAULT_HEADING: Record<FormFlavour, string> = {
  contact: "Get in touch",
  enquiry: "Start an enquiry",
  repair: "Book a repair",
  appointment: "Book an appointment",
};

export default function FormSection({
  flavour,
  content,
  styles,
  theme,
}: SectionProps & { flavour: FormFlavour }) {
  const heading = getString(content, "heading", DEFAULT_HEADING[flavour]);
  const subheading = getString(content, "subheading");
  const fields = FIELDS[flavour];

  return (
    <section
      className="px-4 py-16 sm:py-20"
      style={{
        ...styleOverrides(styles),
        color: styleOverrides(styles).color || theme.secondaryColor,
      }}
    >
      <div className="max-w-2xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl text-center"
          style={{ fontFamily: theme.headingFont }}
        >
          {heading}
        </h2>
        {subheading && (
          <p
            className="text-center mt-3 opacity-70"
            style={{ fontFamily: theme.bodyFont }}
          >
            {subheading}
          </p>
        )}
        <form
          className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4"
          // No-op: forms render visually in Phase 1; submission is wired later.
          onSubmit={undefined}
        >
          {fields.map((f) => {
            const id = `${flavour}-${f.label.toLowerCase().replace(/\s+/g, "-")}`;
            const colSpan = f.fullWidth ? "sm:col-span-2" : "";
            const inputCls =
              "w-full mt-1.5 px-3.5 py-2.5 text-sm rounded-lg border bg-white/70 focus:outline-none focus:ring-2";
            return (
              <div key={id} className={colSpan}>
                <label
                  htmlFor={id}
                  className="text-xs font-medium uppercase tracking-wider opacity-70"
                  style={{ fontFamily: theme.bodyFont }}
                >
                  {f.label}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    id={id}
                    name={id}
                    rows={4}
                    placeholder={f.placeholder}
                    className={inputCls}
                    style={{ borderColor: `${theme.primaryColor}40`, fontFamily: theme.bodyFont }}
                  />
                ) : f.type === "select" ? (
                  <select
                    id={id}
                    name={id}
                    className={inputCls}
                    style={{ borderColor: `${theme.primaryColor}40`, fontFamily: theme.bodyFont }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    {(f.options || []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    name={id}
                    type={f.type}
                    placeholder={f.placeholder}
                    className={inputCls}
                    style={{ borderColor: `${theme.primaryColor}40`, fontFamily: theme.bodyFont }}
                  />
                )}
              </div>
            );
          })}
          <div className="sm:col-span-2 flex justify-center mt-2">
            <button
              type="button"
              className="px-7 py-3 text-sm font-medium rounded-full transition-opacity hover:opacity-90"
              style={{
                backgroundColor: theme.primaryColor,
                color: "#ffffff",
                fontFamily: theme.bodyFont,
              }}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
