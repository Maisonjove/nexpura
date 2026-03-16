'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';

const STEPS = [
  { id: 1, label: 'Files', slug: 'files' },
  { id: 2, label: 'Mapping', slug: 'mapping' },
  { id: 3, label: 'Preview', slug: 'preview' },
  { id: 4, label: 'Import', slug: 'execute' },
  { id: 5, label: 'Done', slug: 'results' },
];

interface MigrationStepperProps {
  sessionId: string;
  currentStep: number; // 1-5
  completedSteps?: number[];
}

export function MigrationStepper({ sessionId, currentStep, completedSteps = [] }: MigrationStepperProps) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const isComplete = completedSteps.includes(step.id) || step.id < currentStep;
        const isCurrent = step.id === currentStep;
        const isClickable = isComplete;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              {isClickable ? (
                <Link
                  href={`/migration/${sessionId}/${step.slug}`}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    isComplete
                      ? 'bg-amber-700 text-white hover:bg-amber-700'
                      : isCurrent
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-400 border border-stone-200'
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : step.id}
                </Link>
              ) : (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isCurrent
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-400 border border-stone-200'
                  }`}
                >
                  {step.id}
                </div>
              )}
              <span
                className={`text-xs mt-1 font-medium ${
                  isCurrent ? 'text-stone-900' : isComplete ? 'text-amber-700' : 'text-stone-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-px w-8 mx-1 mb-4 ${
                  step.id < currentStep ? 'bg-amber-700' : 'bg-stone-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
