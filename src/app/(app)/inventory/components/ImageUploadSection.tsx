import { CollapsibleSection } from "./FormElements";

export default function ImageUploadSection() {
  return (
    <CollapsibleSection title="Images">
      <div className="border-2 border-dashed border-stone-200 rounded-xl p-8 text-center bg-stone-50/50">
        <svg className="w-10 h-10 text-stone-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-stone-400">Image upload available in Sprint 9</p>
      </div>
    </CollapsibleSection>
  );
}
