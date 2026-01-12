// Filter overlay component for toggling type, epic, and tag visibility
import { useState, useCallback } from 'react';
import { useBmfStore, type HoveredFilter } from '../store/bmfStore';
import { getTypeColor, getEpicColor, getTagColor } from '../utils/colorHash';

// Special tag for entities without tags
export const NO_TAGS_FILTER = '_no_tags';

// Group tags by prefix (before colon)
interface TagGroup {
  name: string;
  tags: string[];
}

function groupTagsByPrefix(tags: string[]): TagGroup[] {
  const groups = new Map<string, string[]>();
  const ungrouped: string[] = [];

  tags.forEach((tag) => {
    const colonIndex = tag.indexOf(':');
    if (colonIndex > 0) {
      const prefix = tag.substring(0, colonIndex);
      if (!groups.has(prefix)) {
        groups.set(prefix, []);
      }
      groups.get(prefix)!.push(tag);
    } else {
      ungrouped.push(tag);
    }
  });

  const result: TagGroup[] = [];

  // Add grouped tags first
  groups.forEach((groupTags, name) => {
    result.push({ name, tags: groupTags.sort() });
  });

  // Sort groups alphabetically
  result.sort((a, b) => a.name.localeCompare(b.name));

  // Add ungrouped tags at the end
  if (ungrouped.length > 0) {
    result.push({ name: '', tags: ungrouped.sort() });
  }

  return result;
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

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const tagGroups = groupTagsByPrefix(availableTags);

  const handleMouseEnter = useCallback((category: HoveredFilter['category'], value: string, isHidden: boolean) => {
    if (!isHidden) {
      setHoveredFilter({ category, value });
    }
  }, [setHoveredFilter]);

  const handleMouseLeave = useCallback(() => {
    setHoveredFilter(null);
  }, [setHoveredFilter]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const toggleAllInGroup = (tags: string[]) => {
    const allHidden = tags.every((tag) => hiddenTags.has(tag));
    tags.forEach((tag) => {
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
    const allHidden = availableTags.every((t) => hiddenTags.has(t));
    availableTags.forEach((t) => {
      if (allHidden === hiddenTags.has(t)) toggleTag(t);
    });
  };

  const allTypesHidden = availableTypes.every((t) => hiddenTypes.has(t));
  const allEpicsHidden = availableEpics.every((e) => hiddenEpics.has(e));
  const allTagsHidden = availableTags.every((t) => hiddenTags.has(t));

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
          {tagGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.name);
            const allHidden = group.tags.every((tag) => hiddenTags.has(tag));
            const someHidden = group.tags.some((tag) => hiddenTags.has(tag));
            const groupColor = group.name ? getTagColor(group.name) : undefined;

            return (
              <div key={group.name || '_ungrouped'} className="filter-tag-group">
                {group.name && (
                  <div className="filter-group-header">
                    <button
                      className="filter-group-toggle"
                      onClick={() => toggleGroup(group.name)}
                      title={isCollapsed ? 'Expand group' : 'Collapse group'}
                    >
                      {isCollapsed ? '▶' : '▼'}
                    </button>
                    <button
                      className={`filter-group-name ${allHidden ? 'filter-group-hidden' : ''} ${someHidden && !allHidden ? 'filter-group-partial' : ''}`}
                      style={{
                        borderColor: groupColor,
                        backgroundColor: allHidden ? 'transparent' : `${groupColor}33`,
                      }}
                      onClick={() => toggleAllInGroup(group.tags)}
                      title={allHidden ? `Show all ${group.name}:*` : `Hide all ${group.name}:*`}
                    >
                      {group.name}:
                    </button>
                  </div>
                )}
                {!isCollapsed && (
                  <div className="filter-badges">
                    {group.tags.map((tag) => {
                      const isHidden = hiddenTags.has(tag);
                      const color = getTagColor(tag);
                      const displayName = group.name ? tag.substring(group.name.length + 1) : tag;
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
            );
          })}
        </div>
      )}
    </div>
  );
}
