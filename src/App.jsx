import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Tag, File, Box, Layers, Filter, Upload, Check, Settings } from 'lucide-react';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import STLViewer from './components/STLViewer';
import { renderThumbnail } from './utils/renderThumbnail';
import { saveFile, getAllFiles, updateFile } from './utils/db';
import { analyzeGeometry } from './utils/geometryAnalysis';
import { parseSTLHeader } from './utils/stlHeaderParser';
import { tokenizeFilename } from './utils/filenameTokenizer';
import { estimateWeight, getPrintSettings } from './utils/printEstimate';
import ImportReviewPanel from './components/ImportReviewPanel';
import BulkActionBar from './components/BulkActionBar';
import PrintSettingsPopover from './components/PrintSettingsPopover';

const INITIAL_FILES = [
  { id: 1, name: 'Dungeon Wall Section A', size: '2.4 MB', type: 'terrain', tags: ['OpenForge', '28mm', 'dungeon', 'stone', 'medieval'] },
  { id: 2, name: 'Dungeon Floor Tile Set', size: '5.1 MB', type: 'tile', tags: ['OpenForge', '28mm', 'dungeon', 'stone', 'modular'] },
  { id: 3, name: 'Gothic Archway', size: '3.8 MB', type: 'terrain', tags: ['Dragonlock', '28mm', 'dungeon', 'stone', 'medieval'] },
  { id: 4, name: 'Spiral Staircase', size: '6.2 MB', type: 'terrain', tags: ['OpenForge', '28mm', 'dungeon', 'stone'] },
  { id: 5, name: 'Dungeon Door Pack', size: '1.9 MB', type: 'prop', tags: ['OpenForge', '28mm', 'dungeon', 'medieval'] },
  { id: 6, name: 'Stone Pillar Set', size: '2.7 MB', type: 'prop', tags: ['28mm', 'dungeon', 'stone', 'medieval'] },
  { id: 7, name: 'Ancient Oak Tree', size: '8.4 MB', type: 'terrain', tags: ['28mm', 'forest', 'nature'] },
  { id: 8, name: 'Forest Rock Formation', size: '4.5 MB', type: 'terrain', tags: ['28mm', 'forest', 'nature', 'stone'] },
  { id: 9, name: 'Wooden Bridge', size: '3.3 MB', type: 'terrain', tags: ['28mm', 'forest', 'nature', 'wood'] },
  { id: 10, name: 'Mushroom Cluster', size: '1.2 MB', type: 'scatter', tags: ['28mm', 'forest', 'nature'] },
  { id: 11, name: 'Forest Floor Tiles', size: '7.6 MB', type: 'tile', tags: ['28mm', 'forest', 'nature', 'modular'] },
  { id: 12, name: 'Sci-Fi Barrier Wall', size: '3.1 MB', type: 'terrain', tags: ['32mm', 'sci-fi'] },
  { id: 13, name: 'Control Console', size: '2.0 MB', type: 'prop', tags: ['32mm', 'sci-fi'] },
  { id: 14, name: 'Cargo Crate Stack', size: '1.5 MB', type: 'scatter', tags: ['32mm', 'sci-fi'] },
  { id: 15, name: 'Landing Pad Tile', size: '9.8 MB', type: 'tile', tags: ['32mm', 'sci-fi', 'modular'] },
  { id: 16, name: 'Power Generator', size: '4.2 MB', type: 'prop', tags: ['32mm', 'sci-fi'] },
  { id: 17, name: 'Barrel Collection', size: '1.1 MB', type: 'scatter', tags: ['28mm', 'scatter', 'medieval', 'wood'] },
  { id: 18, name: 'Treasure Chest Set', size: '0.9 MB', type: 'scatter', tags: ['28mm', 'scatter', 'medieval'] },
  { id: 19, name: 'Tavern Table & Chairs', size: '2.3 MB', type: 'prop', tags: ['28mm', 'scatter', 'medieval', 'wood'] },
  { id: 20, name: 'Bookshelf Collection', size: '3.6 MB', type: 'prop', tags: ['28mm', 'scatter', 'medieval', 'wood'] },
  { id: 21, name: 'Campfire Set', size: '0.8 MB', type: 'scatter', tags: ['28mm', 'scatter', 'nature'] },
  { id: 22, name: 'Cavern Tile Set', size: '11.2 MB', type: 'tile', tags: ['OpenForge', '28mm', 'dungeon', 'modular', 'stone'] },
  { id: 23, name: 'Sewer Tile Pack', size: '8.9 MB', type: 'tile', tags: ['OpenForge', '28mm', 'dungeon', 'modular'] },
  { id: 24, name: 'Hex Grass Tiles', size: '6.4 MB', type: 'tile', tags: ['28mm', 'nature', 'modular'] },
  { id: 25, name: 'Cobblestone Road Set', size: '5.7 MB', type: 'tile', tags: ['28mm', 'medieval', 'modular', 'stone'] },
  { id: 26, name: 'Desert Sand Tiles', size: '7.1 MB', type: 'tile', tags: ['28mm', 'nature', 'modular'] },
  { id: 27, name: 'Ruined Tower', size: '15.8 MB', type: 'terrain', tags: ['Dragonlock', '28mm', 'dungeon', 'medieval', 'stone'] },
  { id: 28, name: 'Market Stall', size: '3.4 MB', type: 'prop', tags: ['28mm', 'scatter', 'medieval', 'wood'] },
  { id: 29, name: 'Alien Vegetation Set', size: '4.8 MB', type: 'scatter', tags: ['32mm', 'sci-fi', 'nature'] },
  { id: 30, name: 'Modular Bridge System', size: '10.3 MB', type: 'terrain', tags: ['OpenForge', '28mm', 'modular', 'stone'] },
];

const FILE_TYPES = [
  { value: 'terrain', label: 'Terrain', icon: Box },
  { value: 'tile', label: 'Tiles', icon: Layers },
  { value: 'prop', label: 'Props', icon: File },
  { value: 'scatter', label: 'Scatter', icon: Tag },
];

const TYPE_STYLES = {
  terrain: { gradient: 'from-slate-700 to-slate-600', badge: 'bg-slate-600' },
  tile: { gradient: 'from-indigo-800 to-blue-700', badge: 'bg-indigo-600' },
  prop: { gradient: 'from-amber-800 to-orange-700', badge: 'bg-amber-700' },
  scatter: { gradient: 'from-emerald-800 to-green-700', badge: 'bg-emerald-700' },
};

const TYPE_ICON_MAP = { terrain: Box, tile: Layers, prop: File, scatter: Tag };

export default function App() {
  const [files, setFiles] = useState(INITIAL_FILES);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileTagsEdit, setFileTagsEdit] = useState([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [pendingImports, setPendingImports] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const bulkMode = selectedIds.size > 0;

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  // Load saved files from IndexedDB on mount
  useEffect(() => {
    const loader = new STLLoader();
    getAllFiles().then((saved) => {
      if (saved.length === 0) return;
      const restored = saved.map((entry) => {
        let geometry = null;
        if (entry.stlBuffer) {
          try {
            geometry = loader.parse(entry.stlBuffer);
            geometry.computeVertexNormals();
          } catch (e) {
            console.error(`Failed to restore geometry for ${entry.name}:`, e);
          }
        }
        return {
          id: entry.id,
          name: entry.name,
          size: entry.size,
          type: entry.type,
          tags: entry.tags,
          thumbnail: entry.thumbnail,
          geometry,
          metadata: entry.metadata || null,
        };
      });
      setFiles([...restored, ...INITIAL_FILES]);
    });
  }, []);

  const [selectedCollections, setSelectedCollections] = useState([]);

  const allTags = useMemo(() => {
    const tags = new Set();
    files.forEach((f) => f.tags.forEach((t) => tags.add(t)));
    return [...tags].sort();
  }, [files]);

  const allCollections = useMemo(() => {
    const cols = new Set();
    files.forEach((f) => {
      if (f.metadata?.collection) cols.add(f.metadata.collection);
    });
    return [...cols].sort();
  }, [files]);

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesSearch =
        !searchTerm ||
        file.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType =
        selectedTypes.length === 0 || selectedTypes.includes(file.type);
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => file.tags.includes(tag));
      const matchesCollection =
        selectedCollections.length === 0 ||
        selectedCollections.includes(file.metadata?.collection);
      return matchesSearch && matchesType && matchesTags && matchesCollection;
    });
  }, [files, searchTerm, selectedTypes, selectedTags, selectedCollections]);

  const toggleTag = (tag) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const toggleType = (type) =>
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );

  const toggleCollection = (col) =>
    setSelectedCollections((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );

  const openFile = (file) => {
    setSelectedFile(file);
    setFileTagsEdit([...file.tags]);
    setNewTag('');
  };

  const closeFile = () => {
    setSelectedFile(null);
    setFileTagsEdit([]);
    setNewTag('');
    setShowPrintSettings(false);
  };

  const addEditTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !fileTagsEdit.includes(trimmed)) {
      setFileTagsEdit((prev) => [...prev, trimmed]);
      setNewTag('');
    }
  };

  const removeEditTag = (tag) =>
    setFileTagsEdit((prev) => prev.filter((t) => t !== tag));

  const saveTags = () => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === selectedFile.id ? { ...f, tags: fileTagsEdit } : f
      )
    );
    setSelectedFile((prev) => ({ ...prev, tags: fileTagsEdit }));
    // Persist tag changes for imported files (mock files aren't in IndexedDB)
    if (selectedFile.geometry) {
      updateFile(selectedFile.id, { tags: fileTagsEdit });
    }
  };

  const tagsChanged =
    selectedFile &&
    JSON.stringify(fileTagsEdit.slice().sort()) !==
      JSON.stringify(selectedFile.tags.slice().sort());

  const activeFilterCount = selectedTypes.length + selectedTags.length + selectedCollections.length;

  const clearFilters = () => {
    setSelectedTypes([]);
    setSelectedTags([]);
    setSelectedCollections([]);
    setSearchTerm('');
  };

  /* ---- STL file loading ---- */
  const loadSTLFiles = async (fileList) => {
    const loader = new STLLoader();
    const staged = [];

    for (const file of fileList) {
      try {
        const buffer = await file.arrayBuffer();
        const geometry = loader.parse(buffer);
        geometry.computeVertexNormals();

        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const thumbnail = renderThumbnail(geometry);
        const id = Date.now() + Math.random();

        const geoStats = analyzeGeometry(geometry);
        const headerText = parseSTLHeader(buffer);
        const suggestedTags = tokenizeFilename(file.name);
        const settings = getPrintSettings();
        const estimatedGrams = estimateWeight(geoStats.volume, settings);
        const volumeCm3 = geoStats.volume != null ? +(geoStats.volume / 1000).toFixed(2) : null;

        staged.push({
          id,
          name: file.name.replace(/\.stl$/i, '').replace(/[_-]/g, ' '),
          size: `${sizeMB} MB`,
          type: 'prop',
          tags: [],
          thumbnail,
          geometry,
          stlBuffer: buffer,
          metadata: {
            ...geoStats,
            headerText,
            originalFilename: file.name,
            suggestedTags,
            importedAt: Date.now(),
            lastModified: file.lastModified || null,
            collection: null,
            printEstimate: { volumeCm3, estimatedGrams },
          },
        });
      } catch (err) {
        console.error(`Failed to load ${file.name}:`, err);
      }
    }

    if (staged.length > 0) {
      setPendingImports(staged);
    }
  };

  const confirmImport = (reviewedFiles) => {
    setFiles((prev) => [...reviewedFiles, ...prev]);
    reviewedFiles.forEach((f) => {
      const { geometry, ...rest } = f;
      saveFile(rest);
    });
    setPendingImports([]);
  };

  const cancelImport = () => {
    setPendingImports([]);
  };

  /* ---- Bulk select mode ---- */
  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkAddTags = (tags) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (!selectedIds.has(f.id)) return f;
        const newTags = [...new Set([...f.tags, ...tags])];
        if (f.geometry) updateFile(f.id, { tags: newTags });
        return { ...f, tags: newTags };
      })
    );
  };

  const bulkSetType = (type) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (!selectedIds.has(f.id)) return f;
        if (f.geometry) updateFile(f.id, { type });
        return { ...f, type };
      })
    );
  };

  const bulkSetCollection = (collection) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (!selectedIds.has(f.id)) return f;
        const metadata = { ...(f.metadata || {}), collection };
        if (f.geometry) updateFile(f.id, { metadata });
        return { ...f, metadata };
      })
    );
  };

  // Escape to deselect
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && bulkMode) clearSelection();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bulkMode]);

  const handleFileInput = (e) => {
    const stlFiles = [...e.target.files].filter((f) =>
      f.name.toLowerCase().endsWith('.stl')
    );
    if (stlFiles.length > 0) loadSTLFiles(stlFiles);
    e.target.value = '';
  };

  /* ---- Drag and drop ---- */
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const stlFiles = [...e.dataTransfer.files].filter((f) =>
      f.name.toLowerCase().endsWith('.stl')
    );
    if (stlFiles.length > 0) loadSTLFiles(stlFiles);
  };

  /* ---- Shared filter panel content ---- */
  const renderFilters = (isMobile) => (
    <div className="space-y-6">
      {/* Import button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <Upload className="w-4 h-4" />
        Import STL Files
      </button>

      {/* Search — only in desktop sidebar (mobile has its own in the top bar) */}
      {!isMobile && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search STL files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent transition-shadow"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Type filters */}
      <div>
        <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Type
        </h3>
        <div className="space-y-1">
          {FILE_TYPES.map(({ value, label, icon: Icon }) => {
            const active = selectedTypes.includes(value);
            return (
              <button
                key={value}
                onClick={() => toggleType(value)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
                    : 'text-gray-400 hover:bg-gray-700/40 hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tag filters */}
      <div>
        <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Tags
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  active
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 ring-1 ring-gray-700'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collection filters */}
      {allCollections.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Collections
          </h3>
          <div className="space-y-1">
            {allCollections.map((col) => {
              const active = selectedCollections.includes(col);
              return (
                <button
                  key={col}
                  onClick={() => toggleCollection(col)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
                      : 'text-gray-400 hover:bg-gray-700/40 hover:text-gray-200'
                  }`}
                >
                  {col}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeFilterCount > 0 && (
        <button
          onClick={clearFilters}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div
      className="min-h-screen bg-gray-950 text-gray-100"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {/* ===== Drag overlay ===== */}
      {isDragging && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-blue-500/10 backdrop-blur-sm pointer-events-none">
          <div className="text-center p-8 rounded-2xl border-2 border-dashed border-blue-500/50 bg-gray-900/80">
            <Upload className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <p className="text-xl font-semibold text-blue-300">
              Drop STL files here
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Files will be added to your library
            </p>
          </div>
        </div>
      )}

      {/* ===== Import review panel ===== */}
      {pendingImports.length > 0 && (
        <ImportReviewPanel
          files={pendingImports}
          onConfirm={confirmImport}
          onCancel={cancelImport}
        />
      )}

      {/* ===== Mobile top bar ===== */}
      <header className="lg:hidden sticky top-0 z-30 bg-gray-950/90 backdrop-blur-md border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Box className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
          </div>
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="relative p-2.5 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Filter className="w-4 h-4 text-gray-400" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-blue-500 text-[10px] font-bold text-white rounded-full px-1">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ===== Mobile filter slide-out ===== */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-gray-900 border-l border-gray-800 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-gray-900/95 backdrop-blur p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-base">Filters</h2>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4">{renderFilters(true)}</div>
          </div>
        </div>
      )}

      {/* ===== Main layout ===== */}
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 border-r border-gray-800 bg-gray-900/60 backdrop-blur-sm">
          <div className="p-5 pb-3 border-b border-gray-800/60">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <Box className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight leading-tight">
                  STL Library
                </h1>
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">
                  Terrain Browser
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{renderFilters(false)}</div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          <div className="mb-5 flex items-baseline justify-between">
            <p className="text-sm text-gray-500">
              <span className="text-gray-300 font-semibold">
                {filteredFiles.length}
              </span>{' '}
              file{filteredFiles.length !== 1 && 's'}
              {activeFilterCount > 0 && ' matching'}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="hidden lg:block text-xs text-gray-500 hover:text-blue-400 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>

          {filteredFiles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFiles.map((file) => {
                const TypeIcon = TYPE_ICON_MAP[file.type] || Box;
                const style = TYPE_STYLES[file.type];
                const has3D = !!file.geometry;
                return (
                  <button
                    key={file.id}
                    onClick={() => openFile(file)}
                    className="group text-left bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {/* Thumbnail area */}
                    <div
                      className={`relative h-40 ${
                        file.thumbnail
                          ? 'bg-gray-950'
                          : `bg-gradient-to-br ${style.gradient}`
                      } flex items-center justify-center overflow-hidden`}
                    >
                      {file.thumbnail ? (
                        <img
                          src={file.thumbnail}
                          alt={file.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <>
                          <div
                            className="absolute inset-0 opacity-[0.04]"
                            style={{
                              backgroundImage:
                                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                              backgroundSize: '20px 20px',
                            }}
                          />
                          <TypeIcon className="w-14 h-14 text-white/10 group-hover:text-white/20 transition-colors duration-300" />
                        </>
                      )}
                      <span
                        className={`absolute top-2.5 right-2.5 ${style.badge} text-white/90 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md z-10`}
                      >
                        {file.type}
                      </span>
                      {/* Checkbox overlay — shows on hover or in bulk mode */}
                      <div
                        className={`absolute top-2.5 left-2.5 z-10 transition-opacity ${
                          bulkMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <button
                          onClick={(e) => toggleSelect(file.id, e)}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            selectedIds.has(file.id)
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-400 bg-black/30 hover:border-blue-400'
                          }`}
                        >
                          {selectedIds.has(file.id) && <Check className="w-4 h-4 text-white" />}
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3.5">
                      <h3 className="font-semibold text-sm text-gray-200 truncate group-hover:text-blue-400 transition-colors">
                        {file.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 font-medium">
                        {file.size}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {file.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-500 ring-1 ring-gray-800"
                          >
                            {tag}
                          </span>
                        ))}
                        {file.tags.length > 3 && (
                          <span className="px-1.5 py-0.5 text-[10px] text-gray-600">
                            +{file.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-24">
              <Box className="w-12 h-12 text-gray-800 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">
                No files match your filters
              </p>
              <button
                onClick={clearFilters}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ===== Bulk action bar ===== */}
      {bulkMode && (
        <BulkActionBar
          count={selectedIds.size}
          totalFiltered={filteredFiles.length}
          onAddTags={bulkAddTags}
          onSetType={bulkSetType}
          onSetCollection={bulkSetCollection}
          onSelectAll={selectAllFiltered}
          onClear={clearSelection}
        />
      )}

      {/* ===== Detail modal ===== */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeFile}
          />
          <div className="relative bg-gray-900 rounded-2xl border border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/50">
            {/* Close button */}
            <button
              onClick={closeFile}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-lg bg-black/30 hover:bg-black/50 transition-colors"
            >
              <X className="w-4 h-4 text-gray-300" />
            </button>

            {/* Large preview */}
            <div
              className={`relative h-72 sm:h-80 ${
                selectedFile.geometry
                  ? 'bg-gray-950'
                  : `bg-gradient-to-br ${TYPE_STYLES[selectedFile.type].gradient}`
              } flex items-center justify-center rounded-t-2xl overflow-hidden`}
            >
              {selectedFile.geometry ? (
                <STLViewer
                  geometry={selectedFile.geometry}
                  interactive
                  className="w-full h-full"
                />
              ) : (
                <>
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage:
                        'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }}
                  />
                  {React.createElement(
                    TYPE_ICON_MAP[selectedFile.type] || Box,
                    { className: 'w-24 h-24 text-white/10' }
                  )}
                </>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              <h2 className="text-xl font-bold tracking-tight">
                {selectedFile.name}
              </h2>
              <div className="flex items-center gap-3 mt-2 mb-5">
                <span className="text-sm text-gray-400 font-medium">
                  {selectedFile.size}
                </span>
                <span
                  className={`${
                    TYPE_STYLES[selectedFile.type].badge
                  } text-white text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md`}
                >
                  {selectedFile.type}
                </span>
                {selectedFile.geometry && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-600 text-white">
                    3D
                  </span>
                )}
              </div>

              {/* Collection — editable */}
              {selectedFile.metadata && (
                <div className="flex items-center gap-2 mt-1 mb-5">
                  <span className="text-xs text-gray-500">Collection:</span>
                  <input
                    type="text"
                    value={selectedFile.metadata?.collection || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedFile((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, collection: val },
                      }));
                    }}
                    onBlur={() => {
                      setFiles((prev) =>
                        prev.map((f) =>
                          f.id === selectedFile.id
                            ? { ...f, metadata: { ...f.metadata, collection: selectedFile.metadata.collection } }
                            : f
                        )
                      );
                      if (selectedFile.geometry) {
                        updateFile(selectedFile.id, { metadata: selectedFile.metadata });
                      }
                    }}
                    placeholder="Add to collection..."
                    className="text-sm bg-transparent border-b border-gray-800 focus:border-blue-500 text-gray-300 placeholder-gray-600 outline-none py-0.5 flex-1"
                  />
                </div>
              )}

              {/* Tag management */}
              <div className="border-t border-gray-800 pt-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" />
                  Tags
                </h3>

                <div className="flex flex-wrap gap-2 mb-4 min-h-[32px]">
                  {fileTagsEdit.map((tag) => (
                    <span
                      key={tag}
                      className="group/tag flex items-center gap-1.5 px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300 ring-1 ring-gray-700"
                    >
                      {tag}
                      <button
                        onClick={() => removeEditTag(tag)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {fileTagsEdit.length === 0 && (
                    <span className="text-sm text-gray-600 italic">
                      No tags
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addEditTag()}
                    placeholder="Add a tag..."
                    className="flex-1 px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent transition-shadow"
                  />
                  <button
                    onClick={addEditTag}
                    disabled={!newTag.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>

                {tagsChanged && (
                  <button
                    onClick={saveTags}
                    className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Save Changes
                  </button>
                )}
              </div>

              {/* Metadata sections */}
              {selectedFile.metadata && (
                <>
                  {/* Geometry stats */}
                  <div className="border-t border-gray-800 pt-5 mt-5">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                      Geometry
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Triangles</span>
                        <p className="text-gray-200 font-medium">
                          {selectedFile.metadata.triangleCount?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Dimensions</span>
                        <p className="text-gray-200 font-medium">
                          {selectedFile.metadata.dimensions
                            ? `${selectedFile.metadata.dimensions.x} × ${selectedFile.metadata.dimensions.y} × ${selectedFile.metadata.dimensions.z}`
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Surface Area</span>
                        <p className="text-gray-200 font-medium">
                          {selectedFile.metadata.surfaceArea?.toLocaleString()} mm²
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Watertight</span>
                        <p className={`font-medium ${selectedFile.metadata.isWatertight ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {selectedFile.metadata.isWatertight ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Print estimate */}
                  {selectedFile.metadata.printEstimate?.volumeCm3 != null && (
                    <div className="border-t border-gray-800 pt-5 mt-5">
                      <div className="relative flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                          Print Estimate
                        </h3>
                        <button
                          onClick={() => setShowPrintSettings((v) => !v)}
                          className="p-1 rounded-md hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        {showPrintSettings && (
                          <PrintSettingsPopover
                            onClose={() => setShowPrintSettings(false)}
                            onSave={(newSettings) => {
                              const vol = selectedFile.metadata.printEstimate.volumeCm3;
                              const newGrams = estimateWeight(vol * 1000, newSettings);
                              const updatedMeta = {
                                ...selectedFile.metadata,
                                printEstimate: {
                                  ...selectedFile.metadata.printEstimate,
                                  estimatedGrams: newGrams,
                                },
                              };
                              setSelectedFile((prev) => ({ ...prev, metadata: updatedMeta }));
                              setFiles((prev) =>
                                prev.map((f) =>
                                  f.id === selectedFile.id
                                    ? { ...f, metadata: updatedMeta }
                                    : f
                                )
                              );
                              if (selectedFile.geometry) {
                                updateFile(selectedFile.id, { metadata: updatedMeta });
                              }
                            }}
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Volume</span>
                          <p className="text-gray-200 font-medium">
                            {selectedFile.metadata.printEstimate.volumeCm3} cm³
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Est. Weight</span>
                          <p className="text-gray-200 font-medium">
                            ~{selectedFile.metadata.printEstimate.estimatedGrams}g
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-600 mt-2">
                        Based on current print settings. Rough estimate only.
                      </p>
                    </div>
                  )}

                  {/* File info */}
                  <div className="border-t border-gray-800 pt-5 mt-5">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                      File Info
                    </h3>
                    <div className="space-y-2 text-sm">
                      {selectedFile.metadata.originalFilename && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Original</span>
                          <span className="text-gray-300 font-mono text-xs">
                            {selectedFile.metadata.originalFilename}
                          </span>
                        </div>
                      )}
                      {selectedFile.metadata.headerText && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Header</span>
                          <span className="text-gray-300 text-xs truncate max-w-[200px]">
                            {selectedFile.metadata.headerText}
                          </span>
                        </div>
                      )}
                      {selectedFile.metadata.importedAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Imported</span>
                          <span className="text-gray-300 text-xs">
                            {new Date(selectedFile.metadata.importedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
