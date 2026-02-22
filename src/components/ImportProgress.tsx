import React from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';

interface ImportProgressProps {
  processed: number;
  total: number;
  currentName: string | null;
  errors: number;
  /** True while awaiting final DB writes before the review panel opens. */
  isFinalizing: boolean;
  onCancel: () => void;
}

export default function ImportProgress({ processed, total, currentName, errors, isFinalizing, onCancel }: ImportProgressProps) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 surface-panel border-x-0 rounded-t-2xl px-6 py-3">
      <div className="max-w-4xl mx-auto flex items-center gap-4">
        {/* Icon */}
        {isFinalizing ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        ) : (
          <Loader2 className="w-5 h-5 text-blue-400 flex-shrink-0 animate-spin" />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-slate-100 truncate">
              {isFinalizing
                ? 'Saving to library\u2026'
                : `Processing ${currentName || '\u2026'} (${processed} of ${total})`}
            </p>
            <span className="text-xs text-soft ml-2 flex-shrink-0">
              {processed} processed{errors > 0 && `, ${errors} error${errors !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[rgba(11,20,34,0.8)] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isFinalizing ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Cancel button — hidden while finalizing */}
        {!isFinalizing && (
          <button
            onClick={onCancel}
            className="ui-btn ui-btn-secondary p-1.5 flex-shrink-0"
            title="Cancel import"
          >
            <X className="w-4 h-4 text-soft" />
          </button>
        )}
      </div>
    </div>
  );
}
