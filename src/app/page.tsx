'use client';

import dynamic from 'next/dynamic';

const LabelApp = dynamic(() => import('./LabelApp'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E8922A] to-[#2B7CB8] flex items-center justify-center animate-pulse">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">Loading Label Maker...</p>
          <p className="text-xs text-gray-400 mt-1">Preparing your workspace</p>
        </div>
      </div>
    </div>
  ),
});

export default function Page() {
  return <LabelApp />;
}
