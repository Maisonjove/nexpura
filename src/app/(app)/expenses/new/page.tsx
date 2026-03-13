import ExpenseForm from "../ExpenseForm";

export default function NewExpensePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">Add Expense</h1>
        <p className="text-stone-500 mt-1 text-sm">Record a new business expense.</p>
      </div>
      <ExpenseForm mode="create" />
    </div>
  );
}
