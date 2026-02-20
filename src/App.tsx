import { Box } from 'lucide-react';
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
import { useLibrary } from './hooks/useLibrary';
import { useFilters } from './hooks/useFilters';
import { useSelection } from './hooks/useSelection';
import { useImport } from './hooks/useImport';
import { useFileDetail } from './hooks/useFileDetail';
import { useDragDrop } from './hooks/useDragDrop';

export default function App() {
  const {
    files, isRestoring, setDirectories,
    allTags, categoryFacets,
    addFiles, updateFileInList, bulkAddTags, bulkSetCategory,
  } = useLibrary();

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

  const {
    selectedFile, fileTagsEdit, fileCategoriesEdit, setFileCategoriesEdit,
    newTag, setNewTag, viewerState, showPrintSettings, setShowPrintSettings,
    openFile, closeFile, handleLoad3D,
    addEditTag, removeEditTag, saveTags, saveCategories, savePrintSettings,
    tagsChanged, categoriesChanged,
  } = useFileDetail({ updateFileInList });

  const filterSidebarProps = {
    searchTerm, onSearchChange: setSearchTerm,
    categoryFacets, selectedCategories, onToggleCategoryValue: toggleCategoryValue,
    allTags, selectedTags, onToggleTag: toggleTag,
    activeFilterCount, onClearFilters: clearFilters,
    onImportFiles: () => fileInputRef.current?.click(),
    onOpenFolder: handleOpenFolder,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" {...dragHandlers}>
      <input ref={fileInputRef} type="file" accept=".stl" multiple className="hidden" onChange={handleFileInput} />

      <DragOverlay isDragging={isDragging} />

      {importState.status === 'processing' && (
        <ImportProgress
          processed={importState.processed}
          total={importState.total}
          currentName={importState.currentName}
          errors={importState.errors.length}
          isComplete={false}
          onCancel={cancelImport}
          onOpenReview={() => {}}
        />
      )}

      {(importState.status === 'processing' || importState.status === 'reviewing') && (
        <ImportReviewPanel
          files={importState.files}
          onConfirm={confirmImport}
          onCancel={cancelImport}
          isProcessing={importState.status === 'processing'}
          processedCount={importState.processed}
          totalCount={importState.total}
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
        <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 border-r border-gray-800 bg-gray-900/60 backdrop-blur-sm">
          <div className="p-5 pb-3 border-b border-gray-800/60">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <Box className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight leading-tight">STL Library</h1>
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">Terrain Browser</p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <FilterSidebar {...filterSidebarProps} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-4 lg:p-6">
          {isRestoring && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
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
