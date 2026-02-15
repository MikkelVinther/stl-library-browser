import React, { useState } from 'react';
import { X } from 'lucide-react';

const FILE_TYPES = [
  { value: 'terrain', label: 'Terrain' },
  { value: 'tile', label: 'Tiles' },
  { value: 'prop', label: 'Props' },
  { value: 'scatter', label: 'Scatter' },
];

export default function BulkActionBar({
  count,
  totalFiltered,
  onAddTags,
  onSetType,
  onSetCollection,
  onSelectAll,
  onClear,
}) {
  const [tagInput, setTagInput] = useState('');
  const [collectionInput, setCollectionInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showCollectionInput, setShowCollectionInput] = useState(false);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed) {
      onAddTags(trimmed.split(',').map((t) => t.trim()).filter(Boolean));
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const handleSetCollection = () => {
    const trimmed = collectionInput.trim();
    if (trimmed) {
      onSetCollection(trimmed);
      setCollectionInput('');
      setShowCollectionInput(false);
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

      {/* Set Type */}
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) onSetType(e.target.value);
          e.target.value = '';
        }}
        className="bg-gray-700 border border-gray-600 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
      >
        <option value="" disabled>Set Type</option>
        {FILE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* Set Collection */}
      {showCollectionInput ? (
        <div className="flex gap-1">
          <input
            type="text"
            value={collectionInput}
            onChange={(e) => setCollectionInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetCollection()}
            placeholder="Collection name..."
            autoFocus
            className="w-36 bg-gray-900 border border-gray-600 rounded-lg text-xs text-gray-200 px-2 py-1.5 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button onClick={handleSetCollection} className="px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-500">
            Set
          </button>
          <button onClick={() => setShowCollectionInput(false)} className="p-1.5 text-gray-500 hover:text-gray-300">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCollectionInput(true)}
          className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Collection
        </button>
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
