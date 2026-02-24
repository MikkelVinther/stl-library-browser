import { useCallback, useMemo } from 'react';
import { Box, Sun, Moon } from 'lucide-react';
import ImportReviewPanel from './components/ImportReviewPanel';
import ImportProgress from './components/ImportProgress';
import BulkActionBar from './components/BulkActionBar';
import { DragOverlay } from './components/DragOverlay';
import { ContentHeader } from './components/ContentHeader';
import { MobileTopBar } from './components/MobileTopBar';
import { MobileFilterDrawer } from './components/MobileFilterDrawer';
import { FilterSidebar } from './components/FilterSidebar';
import { FileGrid } from './components/FileGrid';
import { FileDetailModal } from './components/FileDetailModal';
import SceneBuilder from './components/scene/SceneBuilder';
import { useLibrary } from './hooks/useLibrary';
import { useFilters } from './hooks/useFilters';
import { useSelection } from './hooks/useSelection';
import { useImport } from './hooks/useImport';
import { useFileDetail } from './hooks/useFileDetail';
import { useDragDrop } from './hooks/useDragDrop';
import { useTheme } from './hooks/useTheme';
import { useSceneManager } from './hooks/useSceneManager';
import type { STLFile } from './types/index';

export default function App() {
  const {
    files, isRestoring, setDirectories,
    allTags, categoryFacets,
    addFiles, updateFileInList, bulkAddTags, bulkSetCategory,
  } = useLibrary();

  const { scenes, activeScene, createScene, openScene, closeScene, deleteScene, setActiveScene, refreshScenes } = useSceneManager();

  const {
    searchTerm, setSearchTerm, selectedTags, selectedCategories,
    mobileFiltersOpen, setMobileFiltersOpen,
    filteredFiles, toggleTag, toggleCategoryValue, activeFilterCount, clearFilters,
  } = useFilters(files);

  const { selectedIds, bulkMode, toggleSelect, selectAllFiltered, clearSelection } = useSelection(filteredFiles);

  const {
    importState, fileInputRef,
    handleOpenFolder, handleDroppedFiles, handleFileInput, confirmImport, cancelImport,
  } = useImport({ addFiles, setDirectories });

  const { isDragging, dragHandlers } = useDragDrop(handleDroppedFiles);
  const { theme, toggleTheme } = useTheme();

  const {
    selectedFile, fileTagsEdit, fileCategoriesEdit, setFileCategoriesEdit,
    newTag, setNewTag, viewerState, showPrintSettings, setShowPrintSettings,
    openFile, closeFile, handleLoad3D,
    addEditTag, removeEditTag, saveTags, saveCategories, savePrintSettings,
    tagsChanged, categoriesChanged,
  } = useFileDetail({ updateFileInList });

  const onImportFiles = useCallback(() => fileInputRef.current?.click(), [fileInputRef]);

  const handleNewScene = useCallback((selectedFiles: STLFile[]) => {
    const validFiles = selectedFiles.filter((f) => f.fullPath !== null);
    createScene('New Scene', validFiles.map((f) => ({
      id: f.id, name: f.name, fullPath: f.fullPath, thumbnail: f.thumbnail,
    })));
  }, [createScene]);

  const filterSidebarProps = useMemo(() => ({
    searchTerm, onSearchChange: setSearchTerm,
    categoryFacets, selectedCategories, onToggleCategoryValue: toggleCategoryValue,
    allTags, selectedTags, onToggleTag: toggleTag,
    activeFilterCount, onClearFilters: clearFilters,
    onImportFiles,
    onOpenFolder: handleOpenFolder,
    scenes,
    onOpenScene: openScene,
    onDeleteScene: deleteScene,
    onNewEmptyScene: () => createScene('New Scene'),
  }), [
    searchTerm, setSearchTerm, categoryFacets, selectedCategories, toggleCategoryValue,
    allTags, selectedTags, toggleTag, activeFilterCount, clearFilters,
    onImportFiles, handleOpenFolder, scenes, openScene, deleteScene, createScene,
  ]);

  if (activeScene) {
    return (
      <SceneBuilder
        sceneState={activeScene}
        setSceneState={setActiveScene}
        allFiles={files}
        onClose={closeScene}
        onRefreshScenes={refreshScenes}
      />
    );
  }

  return (
    <div className="app-shell" {...dragHandlers}>
      <input ref={fileInputRef} type="file" accept=".stl" multiple className="hidden" onChange={handleFileInput} />

      <DragOverlay isDragging={isDragging} />

      {(importState.status === 'processing' || importState.status === 'finalizing') && (
        <ImportProgress
          processed={importState.processed}
          total={importState.total}
          currentName={importState.currentName}
          errors={importState.errors.length}
          isFinalizing={importState.status === 'finalizing'}
          onCancel={cancelImport}
        />
      )}

      {importState.status === 'reviewing' && (
        <ImportReviewPanel
          files={importState.files}
          onConfirm={confirmImport}
          onCancel={cancelImport}
        />
      )}

      <MobileTopBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setMobileFiltersOpen(true)}
      />

      <MobileFilterDrawer isOpen={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)}>
        <FilterSidebar {...filterSidebarProps} isMobile />
      </MobileFilterDrawer>

      <div className="flex">
        <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 surface-panel border-r-0 rounded-r-3xl">
          <div className="p-5 pb-3 border-b border-[rgba(146,173,220,0.18)]">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="p-1.5 rounded-lg bg-[rgba(58,203,255,0.14)] ring-1 ring-[rgba(58,203,255,0.35)]">
                <Box className="w-5 h-5 text-cyan-200" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold leading-tight brand-title">STL Library</h1>
                <p className="text-[10px] text-faint font-semibold uppercase tracking-[0.18em]">Terrain Browser</p>
              </div>
              <button
                onClick={toggleTheme}
                aria-label={theme === 'prototype-dark' ? 'Switch to presentation theme' : 'Switch to prototype theme'}
                title={theme === 'prototype-dark' ? 'Presentation theme' : 'Prototype theme'}
                className="p-1.5 ui-btn ui-btn-ghost flex-shrink-0"
              >
                {theme === 'prototype-dark' ? (
                  <Sun className="w-4 h-4 text-soft" />
                ) : (
                  <Moon className="w-4 h-4 text-soft" />
                )}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <FilterSidebar {...filterSidebarProps} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-4 lg:p-6">
          {isRestoring && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 surface-panel rounded-xl text-sm text-soft">
              <div className="w-4 h-4 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
              Restoring library...
            </div>
          )}
          <ContentHeader
            filteredCount={filteredFiles.length}
            activeFilterCount={activeFilterCount}
            onSelectAll={selectAllFiltered}
            onClearFilters={clearFilters}
          />
          <FileGrid
            files={filteredFiles}
            selectedIds={selectedIds}
            bulkMode={bulkMode}
            onOpenFile={openFile}
            onToggleSelect={toggleSelect}
            onClearFilters={clearFilters}
          />
        </main>
      </div>

      {bulkMode && (
        <BulkActionBar
          count={selectedIds.size}
          totalFiltered={filteredFiles.length}
          onAddTags={(tags) => bulkAddTags(selectedIds, tags)}
          onSetCategory={(catId, value) => bulkSetCategory(selectedIds, catId, value)}
          onSelectAll={selectAllFiltered}
          onClear={clearSelection}
          onNewScene={() => {
            const selectedFiles = filteredFiles.filter((f) => selectedIds.has(f.id));
            handleNewScene(selectedFiles);
          }}
          hasFilesWithoutPath={filteredFiles.some((f) => selectedIds.has(f.id) && f.fullPath === null)}
        />
      )}

      {selectedFile && (
        <FileDetailModal
          file={selectedFile}
          fileTagsEdit={fileTagsEdit}
          fileCategoriesEdit={fileCategoriesEdit}
          onCategoryChange={(catId, value) => setFileCategoriesEdit((prev) => ({ ...prev, [catId]: value }))}
          newTag={newTag}
          onNewTagChange={setNewTag}
          viewerState={viewerState}
          showPrintSettings={showPrintSettings}
          onTogglePrintSettings={() => setShowPrintSettings((v) => !v)}
          tagsChanged={tagsChanged}
          categoriesChanged={categoriesChanged}
          onClose={closeFile}
          onLoad3D={handleLoad3D}
          onAddTag={addEditTag}
          onRemoveTag={removeEditTag}
          onSaveTags={saveTags}
          onSaveCategories={saveCategories}
          onSavePrintSettings={savePrintSettings}
        />
      )}
    </div>
  );
}
