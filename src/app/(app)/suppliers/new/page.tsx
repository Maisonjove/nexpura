import SupplierForm from "../SupplierForm";

export default function NewSupplierPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-fraunces text-2xl font-semibold text-forest">Add Supplier</h1>
        <p className="text-forest/50 mt-1 text-sm">Add a new supplier to your vendor directory.</p>
      </div>
      <SupplierForm mode="create" />
    </div>
  );
}
