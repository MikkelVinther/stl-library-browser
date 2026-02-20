import { useState, useMemo } from 'react';
import type { STLFile } from '../types/index';

export function useFilters(files: STLFile[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string[]>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesSearch =
        !searchTerm ||
        file.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => file.tags?.includes(tag));
      const matchesCategories = Object.entries(selectedCategories).every(
        ([catId, values]) =>
          values.length === 0 || values.includes(file.categories?.[catId] ?? '')
      );
      return matchesSearch && matchesTags && matchesCategories;
    });
  }, [files, searchTerm, selectedTags, selectedCategories]);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const toggleCategoryValue = (catId: string, value: string) => {
    setSelectedCategories((prev) => {
      const current = prev[catId] || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [catId]: next };
    });
  };

  const activeFilterCount =
    selectedTags.length +
    Object.values(selectedCategories).reduce((sum, vals) => sum + vals.length, 0);

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedCategories({});
    setSearchTerm('');
  };

  return {
    searchTerm,
    setSearchTerm,
    selectedTags,
    selectedCategories,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    filteredFiles,
    toggleTag,
    toggleCategoryValue,
    activeFilterCount,
    clearFilters,
  };
}
