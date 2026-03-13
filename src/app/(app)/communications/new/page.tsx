import CommunicationForm from "../CommunicationForm";

export default function NewCommunicationPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">New Message</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Send an email, SMS, or log an internal note.
        </p>
      </div>
      <CommunicationForm />
    </div>
  );
}
