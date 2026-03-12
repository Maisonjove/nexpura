import CommunicationForm from "../CommunicationForm";

export default function NewCommunicationPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-fraunces text-2xl font-semibold text-forest">New Message</h1>
        <p className="text-forest/50 mt-1 text-sm">
          Send an email, SMS, or log an internal note.
        </p>
      </div>
      <CommunicationForm />
    </div>
  );
}
