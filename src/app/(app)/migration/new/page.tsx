import { MIGRATION_SOURCES } from '@/lib/migration/adapters';
import { SourceCard } from '../_components/SourceCard';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getAuthOrReviewContext } from "@/lib/auth/review";
import { redirect } from "next/navigation";

export default async function NewMigrationPage({
  searchParams,
}: {
  searchParams: Promise<{ rt?: string }>;
}) {
  const params = await searchParams;
  const { tenantId } = await getAuthOrReviewContext(params.rt);

  if (!tenantId) {
    redirect("/login");
  }

  const jewellery = MIGRATION_SOURCES.filter(s => s.category === 'jewellery');
  const retail = MIGRATION_SOURCES.filter(s => s.category === 'retail');
  const accounting = MIGRATION_SOURCES.filter(s => s.category === 'accounting');
  const generic = MIGRATION_SOURCES.filter(s => s.category === 'generic');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/migration" className="text-stone-400 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Choose Your Current System</h1>
          <p className="text-stone-500 text-sm mt-0.5">Select the platform you&apos;re migrating from</p>
        </div>
      </div>

      {/* Jewellery POS */}
      <div>
        <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span>💎</span> Jewellery POS Systems
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jewellery.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      </div>

      {/* Retail */}
      <div>
        <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span>🛍️</span> Retail & eCommerce
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {retail.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      </div>

      {/* Accounting */}
      <div>
        <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span>📊</span> Accounting
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounting.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      </div>

      {/* Generic */}
      <div>
        <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span>📄</span> Generic / Other
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {generic.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      </div>
    </div>
  );
}
