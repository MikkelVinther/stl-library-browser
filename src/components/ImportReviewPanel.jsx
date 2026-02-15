import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

const FILE_TYPES = [
  { value: 'terrain', label: 'Terrain' },
  { value: 'tile', label: 'Tiles' },
  { value: 'prop', label: 'Props' },
  { value: 'scatter', label: 'Scatter' },
];

export default function ImportReviewPanel({ files, onConfirm, onCancel }) {
  const [editedFiles, setEditedFiles] = useState(() =>
    files.map((f) => ({
      ...f,
      pendingSuggestions: [...(f.metadata?.suggestedTags || [])],
    }))
  );
  const [bulkCollection, setBulkCollection] = useState('');
  const [bulkTag, setBulkTag] = useState('');
  const [bulkType, setBulkType] = useState('');

  const updateFile = (id, updates) => {
    setEditedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const acceptSuggestion = (fileId, tag) => {
    setEditedFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        if (f.tags.includes(tag)) {
          return { ...f, pendingSuggestions: f.pendingSuggestions.filter((t) => t !== tag) };
        }
        return {
          ...f,
          tags: [...f.tags, tag],
          pendingSuggestions: f.pendingSuggestions.filter((t) => t !== tag),
        };
      })
    );
  };

  const dismissSuggestion = (fileId, tag) => {
    setEditedFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, pendingSuggestions: f.pendingSuggestions.filter((t) => t !== tag) }
          : f
      )
    );
  };

  const acceptAllSuggestions = (fileId) => {
    setEditedFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const newTags = [...new Set([...f.tags, ...f.pendingSuggestions])];
        return { ...f, tags: newTags, pendingSuggestions: [] };
      })
    );
  };

  const addBulkTag = () => {
    const trimmed = bulkTag.trim();
    if (!trimmed) return;
    setEditedFiles((prev) =>
      prev.map((f) =>
        f.tags.includes(trimmed) ? f : { ...f, tags: [...f.tags, trimmed] }
      )
    );
    setBulkTag('');
  };

  const applyBulkCollection = () => {
    if (!bulkCollection.trim()) return;
    setEditedFiles((prev) =>
      prev.map((f) => ({
        ...f,
        metadata: { ...f.metadata, collection: bulkCollection.trim() },
      }))
    );
  };

  const applyBulkType = () => {
    if (!bulkType) return;
    setEditedFiles((prev) => prev.map((f) => ({ ...f, type: bulkType })));
  };

  const handleConfirm = () => {
    const cleaned = editedFiles.map(({ pendingSuggestions, ...rest }) => ({
      ...rest,
      metadata: {
        ...rest.metadata,
        suggestedTags: pendingSuggestions,
      },
    }));
    onConfirm(cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Panel */}
      <div className="relative bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold">
            Import {editedFiles.length} file{editedFiles.length !== 1 && 's'}
          </h2>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {editedFiles.map((file) => (
            <div key={file.id} className="flex gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-800">
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-950 flex-shrink-0">
                {file.thumbnail && (
                  <img src={file.thumbnail} alt="" className="w-full h-full object-contain" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>

                {/* Suggested tags */}
                {file.pendingSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mr-1">Suggested:</span>
                    {file.pendingSuggestions.map((tag) => (
                      <span key={tag} className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-blue-300 border border-dashed border-blue-500/40 bg-blue-500/5">
                        {tag}
                        <button onClick={() => acceptSuggestion(file.id, tag)} className="text-emerald-400 hover:text-emerald-300">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={() => dismissSuggestion(file.id, tag)} className="text-gray-500 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => acceptAllSuggestions(file.id)}
                      className="text-[10px] text-blue-400 hover:text-blue-300 ml-1"
                    >
                      Accept all
                    </button>
                  </div>
                )}

                {/* Confirmed tags */}
                {file.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {file.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-700 rounded-full text-xs text-gray-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Type + Collection row */}
                <div className="flex gap-3 items-center">
                  <select
                    value={file.type}
                    onChange={(e) => updateFile(file.id, { type: e.target.value })}
                    className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {FILE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Collection..."
                    value={file.metadata?.collection || ''}
                    onChange={(e) =>
                      updateFile(file.id, {
                        metadata: { ...file.metadata, collection: e.target.value },
                      })
                    }
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bulk apply bar */}
        <div className="border-t border-gray-800 px-6 py-4 space-y-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Apply to all</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Collection for all..."
              value={bulkCollection}
              onChange={(e) => setBulkCollection(e.target.value)}
              onBlur={applyBulkCollection}
              onKeyDown={(e) => e.key === 'Enter' && applyBulkCollection()}
              className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-3 py-1.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="Add tag to all..."
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBulkTag()}
                className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-3 py-1.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={addBulkTag}
                disabled={!bulkTag.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            <select
              value={bulkType}
              onChange={(e) => { setBulkType(e.target.value); }}
              onBlur={applyBulkType}
              className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Type for all...</option>
              {FILE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
