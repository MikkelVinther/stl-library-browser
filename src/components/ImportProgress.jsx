import React from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';

export default function ImportProgress({ processed, total, currentName, errors, isComplete, onCancel, onOpenReview }) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-700 shadow-2xl px-6 py-3">
      <div className="max-w-4xl mx-auto flex items-center gap-4">
        {/* Icon */}
        {isComplete ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        ) : (
          <Loader2 className="w-5 h-5 text-blue-400 flex-shrink-0 animate-spin" />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-200 truncate">
              {isComplete
                ? `Done — ${processed} file${processed !== 1 ? 's' : ''} processed`
                : `Processing ${currentName || '...'} (${processed} of ${total})`}
            </p>
            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
              {processed} processed{errors > 0 && `, ${errors} error${errors !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        {isComplete ? (
          <button
            onClick={onOpenReview}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
          >
            Review
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
            title="Cancel import"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}
