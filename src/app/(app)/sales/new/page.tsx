import SaleForm from "../SaleForm";

export default function NewSalePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-fraunces text-2xl font-semibold text-forest">New Sale</h1>
        <p className="text-forest/50 mt-1 text-sm">Create a new sales transaction.</p>
      </div>
      <SaleForm />
    </div>
  );
}
