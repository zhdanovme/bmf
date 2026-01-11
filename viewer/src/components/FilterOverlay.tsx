// Filter overlay component for toggling type, epic, and tag visibility
import { useState, useCallback, useEffect } from 'react';
import { useBmfStore, type HoveredFilter } from '../store/bmfStore';
import { getTypeColor, getEpicColor, getTagColor } from '../utils/colorHash';

const EXPANDED_GROUPS_KEY = 'bmf-viewer-expanded-tag-groups';

// Special tag for entities without tags
export const NO_TAGS_FILTER = '_no_tags';

// Tree node for hierarchical tag display
interface TagTreeNode {
  prefix: string; // Full prefix path (e.g., "A:B:C")
  label: string; // Display label (e.g., "C")
  children: TagTreeNode[];
  leafTags: string[]; // Direct leaf tags under this node
}

function buildTagTree(tags: string[]): { roots: TagTreeNode[]; ungrouped: string[] } {
  const nodeMap = new Map<string, TagTreeNode>();
  const ungrouped: string[] = [];

  // First pass: identify all unique prefixes and their parent relationships
  tags.forEach((tag) => {
    const parts = tag.split(':');
    if (parts.length === 1) {
      ungrouped.push(tag);
      return;
    }

    // Create/update nodes for each prefix level
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join(':');
      if (!nodeMap.has(prefix)) {
        nodeMap.set(prefix, {
          prefix,
          label: parts[i - 1],
          children: [],
          leafTags: [],
        });
      }
    }

    // Add tag as leaf to its direct parent prefix
    const parentPrefix = parts.slice(0, -1).join(':');
    const node = nodeMap.get(parentPrefix);
    if (node) {
      node.leafTags.push(tag);
    }
  });

  // Second pass: build parent-child relationships
  nodeMap.forEach((node, prefix) => {
    const parts = prefix.split(':');
    if (parts.length > 1) {
      const parentPrefix = parts.slice(0, -1).join(':');
      const parent = nodeMap.get(parentPrefix);
      if (parent) {
        parent.children.push(node);
      }
    }
  });

  // Get root nodes (single-level prefixes)
  const roots: TagTreeNode[] = [];
  nodeMap.forEach((node, prefix) => {
    if (!prefix.includes(':')) {
      roots.push(node);
    }
  });

  // Sort everything
  const sortNodes = (nodes: TagTreeNode[]) => {
    nodes.sort((a, b) => a.prefix.localeCompare(b.prefix));
    nodes.forEach((node) => {
      node.leafTags.sort();
      sortNodes(node.children);
    });
  };
  sortNodes(roots);
  ungrouped.sort();

  return { roots, ungrouped };
}

// Recursive component to render a tag tree node
function TagTreeNodeComponent({
  node,
  depth,
  expandedGroups,
  toggleGroup,
  toggleAllInPrefix,
  hiddenTags,
  toggleTag,
  availableTags,
  handleMouseEnter,
  handleMouseLeave,
}: {
  node: TagTreeNode;
  depth: number;
  expandedGroups: Set<string>;
  toggleGroup: (prefix: string) => void;
  toggleAllInPrefix: (prefix: string) => void;
  hiddenTags: Set<string>;
  toggleTag: (tag: string) => void;
  availableTags: string[];
  handleMouseEnter: (category: HoveredFilter['category'], value: string, isHidden: boolean) => void;
  handleMouseLeave: () => void;
}) {
  const isExpanded = expandedGroups.has(node.prefix);
  const hasContent = node.children.length > 0 || node.leafTags.length > 0;

  // Check all tags under this prefix
  const matchingTags = availableTags.filter((tag) => tag.startsWith(node.prefix + ':'));
  const allHidden = matchingTags.length > 0 && matchingTags.every((tag) => hiddenTags.has(tag));
  const someHidden = matchingTags.some((tag) => hiddenTags.has(tag));
  const groupColor = getTagColor(node.prefix);

  if (!hasContent) return null;

  return (
    <div className="filter-tag-tree-node" style={{ marginLeft: depth > 0 ? 12 : 0 }}>
      <div className="filter-group-header">
        <button
          className="filter-group-toggle"
          onClick={() => toggleGroup(node.prefix)}
          title={isExpanded ? 'Collapse group' : 'Expand group'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
        <button
          className={`filter-group-name ${allHidden ? 'filter-group-hidden' : ''} ${someHidden && !allHidden ? 'filter-group-partial' : ''}`}
          style={{
            borderColor: groupColor,
            backgroundColor: allHidden ? 'transparent' : `${groupColor}33`,
          }}
          onClick={() => toggleAllInPrefix(node.prefix)}
          title={allHidden ? `Show all ${node.prefix}:*` : `Hide all ${node.prefix}:*`}
        >
          {node.label}:
        </button>
      </div>
      {isExpanded && (
        <div className="filter-tag-tree-content">
          {/* Render child nodes first */}
          {node.children.map((child) => (
            <TagTreeNodeComponent
              key={child.prefix}
              node={child}
              depth={depth + 1}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              toggleAllInPrefix={toggleAllInPrefix}
              hiddenTags={hiddenTags}
              toggleTag={toggleTag}
              availableTags={availableTags}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
            />
          ))}
          {/* Render leaf tags */}
          {node.leafTags.length > 0 && (
            <div className="filter-badges" style={{ marginLeft: 12 }}>
              {node.leafTags.map((tag) => {
                const isHidden = hiddenTags.has(tag);
                const color = getTagColor(tag);
                const displayName = tag.substring(node.prefix.length + 1);
                return (
                  <button
                    key={tag}
                    className={`filter-badge ${isHidden ? 'filter-badge-hidden' : ''}`}
                    style={{
                      backgroundColor: isHidden ? 'transparent' : color,
                      borderColor: color,
                    }}
                    onClick={() => toggleTag(tag)}
                    onMouseEnter={() => handleMouseEnter('tag', tag, isHidden)}
                    onMouseLeave={handleMouseLeave}
                    title={isHidden ? `Show ${tag}` : `Hide ${tag}`}
                  >
                    {displayName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FilterOverlay() {
  const availableTypes = useBmfStore((s) => s.availableTypes);
  const availableEpics = useBmfStore((s) => s.availableEpics);
  const availableTags = useBmfStore((s) => s.availableTags);
  const hiddenTypes = useBmfStore((s) => s.hiddenTypes);
  const hiddenEpics = useBmfStore((s) => s.hiddenEpics);
  const hiddenTags = useBmfStore((s) => s.hiddenTags);
  const toggleType = useBmfStore((s) => s.toggleType);
  const toggleEpic = useBmfStore((s) => s.toggleEpic);
  const toggleTag = useBmfStore((s) => s.toggleTag);
  const setHoveredFilter = useBmfStore((s) => s.setHoveredFilter);

  // Store expanded groups (collapsed by default)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_GROUPS_KEY);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
    return new Set();
  });

  // Persist expanded groups to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify([...expandedGroups]));
    } catch {
      // ignore
    }
  }, [expandedGroups]);

  const { roots: tagTreeRoots, ungrouped: ungroupedTags } = buildTagTree(availableTags);

  const handleMouseEnter = useCallback(
    (category: HoveredFilter['category'], value: string, isHidden: boolean) => {
      if (!isHidden) {
        setHoveredFilter({ category, value });
      }
    },
    [setHoveredFilter]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredFilter(null);
  }, [setHoveredFilter]);

  const toggleGroup = (prefix: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) {
        next.delete(prefix);
      } else {
        next.add(prefix);
      }
      return next;
    });
  };

  const toggleAllInPrefix = (prefix: string) => {
    // Find all tags that start with this prefix
    const matchingTags = availableTags.filter((tag) => tag.startsWith(prefix + ':'));
    const allHidden = matchingTags.every((tag) => hiddenTags.has(tag));
    matchingTags.forEach((tag) => {
      const isHidden = hiddenTags.has(tag);
      if (allHidden && isHidden) {
        toggleTag(tag);
      } else if (!allHidden && !isHidden) {
        toggleTag(tag);
      }
    });
  };

  // Toggle all items in a section
  const toggleAllTypes = () => {
    const allHidden = availableTypes.every((t) => hiddenTypes.has(t));
    availableTypes.forEach((t) => {
      if (allHidden === hiddenTypes.has(t)) toggleType(t);
    });
  };

  const toggleAllEpics = () => {
    const allHidden = availableEpics.every((e) => hiddenEpics.has(e));
    availableEpics.forEach((e) => {
      if (allHidden === hiddenEpics.has(e)) toggleEpic(e);
    });
  };

  const toggleAllTags = () => {
    // Include NO_TAGS_FILTER in the "all tags" toggle
    const allTagsWithNoTags = [...availableTags, NO_TAGS_FILTER];
    const allHidden = allTagsWithNoTags.every((t) => hiddenTags.has(t));
    allTagsWithNoTags.forEach((t) => {
      if (allHidden === hiddenTags.has(t)) toggleTag(t);
    });
  };

  const allTypesHidden = availableTypes.every((t) => hiddenTypes.has(t));
  const allEpicsHidden = availableEpics.every((e) => hiddenEpics.has(e));
  const allTagsHidden = [...availableTags, NO_TAGS_FILTER].every((t) => hiddenTags.has(t));

  if (availableTypes.length === 0 && availableEpics.length === 0 && availableTags.length === 0) {
    return null;
  }

  return (
    <div className="filter-overlay">
      <div className="filter-section">
        <div className="filter-section-header">
          <div className="filter-section-title">Types</div>
          <button
            className="filter-toggle-all"
            onClick={toggleAllTypes}
            title={allTypesHidden ? 'Show all types' : 'Hide all types'}
          >
            {allTypesHidden ? 'show all' : 'hide all'}
          </button>
        </div>
        <div className="filter-badges">
          {availableTypes.map((type) => {
            const isHidden = hiddenTypes.has(type);
            const color = getTypeColor(type);
            return (
              <button
                key={type}
                className={`filter-badge ${isHidden ? 'filter-badge-hidden' : ''}`}
                style={{
                  backgroundColor: isHidden ? 'transparent' : color,
                  borderColor: color,
                }}
                onClick={() => toggleType(type)}
                onMouseEnter={() => handleMouseEnter('type', type, isHidden)}
                onMouseLeave={handleMouseLeave}
                title={isHidden ? `Show ${type}` : `Hide ${type}`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {availableEpics.length > 0 && (
        <div className="filter-section">
          <div className="filter-section-header">
            <div className="filter-section-title">Epics</div>
            <button
              className="filter-toggle-all"
              onClick={toggleAllEpics}
              title={allEpicsHidden ? 'Show all epics' : 'Hide all epics'}
            >
              {allEpicsHidden ? 'show all' : 'hide all'}
            </button>
          </div>
          <div className="filter-badges">
            {availableEpics.map((epic) => {
              const isHidden = hiddenEpics.has(epic);
              const color = getEpicColor(epic);
              return (
                <button
                  key={epic}
                  className={`filter-badge ${isHidden ? 'filter-badge-hidden' : ''}`}
                  style={{
                    backgroundColor: isHidden ? 'transparent' : color,
                    borderColor: color,
                  }}
                  onClick={() => toggleEpic(epic)}
                  onMouseEnter={() => handleMouseEnter('epic', epic, isHidden)}
                  onMouseLeave={handleMouseLeave}
                  title={isHidden ? `Show ${epic}` : `Hide ${epic}`}
                >
                  {epic}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {availableTags.length > 0 && (
        <div className="filter-section">
          <div className="filter-section-header">
            <div className="filter-section-title">Tags</div>
            <button
              className="filter-toggle-all"
              onClick={toggleAllTags}
              title={allTagsHidden ? 'Show all tags' : 'Hide all tags'}
            >
              {allTagsHidden ? 'show all' : 'hide all'}
            </button>
          </div>
          <div className="filter-badges filter-special-tags">
            {(() => {
              const isHidden = hiddenTags.has(NO_TAGS_FILTER);
              return (
                <button
                  className={`filter-badge filter-badge-special ${isHidden ? 'filter-badge-hidden' : ''}`}
                  style={{
                    backgroundColor: isHidden ? 'transparent' : '#475569',
                    borderColor: '#475569',
                  }}
                  onClick={() => toggleTag(NO_TAGS_FILTER)}
                  onMouseEnter={() => handleMouseEnter('tag', NO_TAGS_FILTER, isHidden)}
                  onMouseLeave={handleMouseLeave}
                  title={isHidden ? 'Show entities without tags' : 'Hide entities without tags'}
                >
                  no tags
                </button>
              );
            })()}
          </div>
          {/* Render tag tree */}
          {tagTreeRoots.map((root) => (
            <TagTreeNodeComponent
              key={root.prefix}
              node={root}
              depth={0}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              toggleAllInPrefix={toggleAllInPrefix}
              hiddenTags={hiddenTags}
              toggleTag={toggleTag}
              availableTags={availableTags}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
            />
          ))}
          {/* Render ungrouped tags */}
          {ungroupedTags.length > 0 && (
            <div className="filter-badges">
              {ungroupedTags.map((tag) => {
                const isHidden = hiddenTags.has(tag);
                const color = getTagColor(tag);
                return (
                  <button
                    key={tag}
                    className={`filter-badge ${isHidden ? 'filter-badge-hidden' : ''}`}
                    style={{
                      backgroundColor: isHidden ? 'transparent' : color,
                      borderColor: color,
                    }}
                    onClick={() => toggleTag(tag)}
                    onMouseEnter={() => handleMouseEnter('tag', tag, isHidden)}
                    onMouseLeave={handleMouseLeave}
                    title={isHidden ? `Show ${tag}` : `Hide ${tag}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
