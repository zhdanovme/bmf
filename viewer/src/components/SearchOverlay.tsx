// Search overlay component for finding and navigating to nodes
import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useBmfStore } from '../store/bmfStore';
import { getTypeColor } from '../utils/colorHash';
import type { BmfGraphNode } from '../types/bmf';

interface SearchOverlayProps {
  onNavigateToNode: (nodeId: string) => void;
}

export function SearchOverlay({ onNavigateToNode }: SearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchOpen = useBmfStore((s) => s.searchOpen);
  const searchQuery = useBmfStore((s) => s.searchQuery);
  const setSearchQuery = useBmfStore((s) => s.setSearchQuery);
  const closeSearch = useBmfStore((s) => s.closeSearch);
  const graph = useBmfStore((s) => s.graph);
  const selectNode = useBmfStore((s) => s.selectNode);

  // Filter nodes based on search query
  const searchResults = useMemo(() => {
    if (!graph || !searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase().trim();

    return graph.nodes
      .filter((node: BmfGraphNode) =>
        node.id.toLowerCase().includes(query) ||
        node.name.toLowerCase().includes(query) ||
        (node.description?.toLowerCase().includes(query)) ||
        node.epic.toLowerCase().includes(query) ||
        node.tags.some(tag => tag.toLowerCase().includes(query))
      )
      .slice(0, 10); // Limit results
  }, [graph, searchQuery]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  // Focus input when opened
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      const node = searchResults[selectedIndex];
      if (node) {
        selectNode(node.id);
        onNavigateToNode(node.id);
        closeSearch();
      }
    }
  }, [closeSearch, searchResults, selectedIndex, selectNode, onNavigateToNode]);

  // Handle result click
  const handleResultClick = useCallback((nodeId: string) => {
    selectNode(nodeId);
    onNavigateToNode(nodeId);
    closeSearch();
  }, [selectNode, onNavigateToNode, closeSearch]);

  if (!searchOpen) return null;

  return (
    <div className="search-overlay">
      <div className="search-input-container">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span className="search-hint">ESC to close</span>
      </div>

      {searchResults.length > 0 && (
        <div className="search-results">
          {searchResults.map((node, index) => (
            <div
              key={node.id}
              className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleResultClick(node.id)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span
                className="search-result-type"
                style={{ backgroundColor: getTypeColor(node.type) }}
              >
                {node.type}
              </span>
              <span className="search-result-name">{node.name}</span>
              {node.epic && (
                <span className="search-result-epic">{node.epic}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {searchQuery.trim() && searchResults.length === 0 && (
        <div className="search-no-results">
          No results found
        </div>
      )}
    </div>
  );
}
