import SaleForm from "../SaleForm";

export default function NewSalePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">New Sale</h1>
        <p className="text-stone-500 mt-1 text-sm">Create a new sales transaction.</p>
      </div>
      <SaleForm />
    </div>
  );
}
