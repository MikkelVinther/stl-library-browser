import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CATEGORY_IDS, CATEGORY_LABELS } from '../utils/categoryClassifier';

export default function BulkActionBar({
  count,
  totalFiltered,
  onAddTags,
  onSetCategory,
  onSelectAll,
  onClear,
}) {
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [catInput, setCatInput] = useState('');
  const [activeCatId, setActiveCatId] = useState(null);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed) {
      onAddTags(trimmed.split(',').map((t) => t.trim()).filter(Boolean));
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const handleSetCategory = () => {
    const trimmed = catInput.trim();
    if (trimmed && activeCatId) {
      onSetCategory(activeCatId, trimmed);
      setCatInput('');
      setActiveCatId(null);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl shadow-black/50">
      <span className="text-sm font-semibold text-gray-200 whitespace-nowrap">
        {count} selected
      </span>

      <div className="w-px h-6 bg-gray-700" />

      {/* Add Tags */}
      {showTagInput ? (
        <div className="flex gap-1">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="tag1, tag2..."
            autoFocus
            className="w-36 bg-gray-900 border border-gray-600 rounded-lg text-xs text-gray-200 px-2 py-1.5 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button onClick={handleAddTag} className="px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-500">
            Add
          </button>
          <button onClick={() => setShowTagInput(false)} className="p-1.5 text-gray-500 hover:text-gray-300">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTagInput(true)}
          className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Add Tags
        </button>
      )}

      {/* Set Category */}
      {activeCatId ? (
        <div className="flex gap-1 items-center">
          <span className="text-[10px] text-gray-500">{CATEGORY_LABELS[activeCatId]}:</span>
          <input
            type="text"
            value={catInput}
            onChange={(e) => setCatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSetCategory();
              if (e.key === 'Escape') { setActiveCatId(null); setCatInput(''); }
            }}
            placeholder="Value..."
            autoFocus
            className="w-24 bg-gray-900 border border-gray-600 rounded-lg text-xs text-gray-200 px-2 py-1.5 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button onClick={handleSetCategory} className="px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-500">
            Set
          </button>
          <button onClick={() => { setActiveCatId(null); setCatInput(''); }} className="p-1.5 text-gray-500 hover:text-gray-300">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) setActiveCatId(e.target.value);
            e.target.value = '';
          }}
          className="bg-gray-700 border border-gray-600 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="" disabled>Set Category</option>
          {CATEGORY_IDS.map((catId) => (
            <option key={catId} value={catId}>{CATEGORY_LABELS[catId]}</option>
          ))}
        </select>
      )}

      <div className="w-px h-6 bg-gray-700" />

      {count < totalFiltered && (
        <button
          onClick={onSelectAll}
          className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
        >
          Select all {totalFiltered}
        </button>
      )}

      <button
        onClick={onClear}
        className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
      >
        Deselect
      </button>
    </div>
  );
}
