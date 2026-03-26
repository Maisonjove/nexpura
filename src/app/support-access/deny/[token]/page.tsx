import { getSupportAccessByToken } from "@/lib/support-access";
import DenyClient from "./DenyClient";

export const metadata = { title: "Deny Support Access — Nexpura" };

interface Props {
  params: Promise<{ token: string }>;
}

export default async function DenyPage({ params }: Props) {
  const { token } = await params;
  const request = await getSupportAccessByToken(token);

  if (!request) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Invalid or Expired Link</h1>
          <p className="text-stone-500 mb-6">This support access link is no longer valid.</p>
          <a href="/" className="text-amber-600 hover:text-amber-700 font-medium">
            Go to Nexpura →
          </a>
        </div>
      </div>
    );
  }

  if (request.status !== "pending") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mb-2">Request Already Processed</h1>
          <p className="text-stone-500">This support access request has already been {request.status}.</p>
        </div>
      </div>
    );
  }

  const tenantData = request.tenants as { business_name?: string; name?: string } | null;
  const businessName = tenantData?.business_name || tenantData?.name || "Unknown Business";

  return (
    <DenyClient
      token={token}
      businessName={businessName}
      requestedByEmail={request.requested_by_email}
    />
  );
}
