// BMF YAML Parser
import YAML from 'yaml';
import type { BmfEntity, BmfEntityType, BmfComponent, BmfReference, ParsedBmf } from '../types/bmf';
import { REFERENCE_PATTERN_GLOBAL, BARE_COMPONENT_PATTERN_GLOBAL } from './patterns';

// Valid BMF entity types
const ENTITY_TYPES: Set<string> = new Set([
  'screen', 'dialog', 'event', 'action', 'component', 'layout', 'entity', 'context'
]);

/**
 * Parse a BMF entity ID (e.g., "screen:epic:name" or "context")
 */
function parseEntityId(key: string): { type: BmfEntityType; epic: string; name: string } | null {
  const parts = key.split(':');

  if (parts.length === 1) {
    // Single word like "context"
    if (ENTITY_TYPES.has(parts[0])) {
      return { type: parts[0] as BmfEntityType, epic: '', name: parts[0] };
    }
    return null;
  }

  if (parts.length >= 2) {
    const type = parts[0];
    if (!ENTITY_TYPES.has(type)) return null;

    if (parts.length === 2) {
      // type:name format
      return { type: type as BmfEntityType, epic: '', name: parts[1] };
    }

    // type:epic:name format
    return {
      type: type as BmfEntityType,
      epic: parts[1],
      name: parts.slice(2).join(':')
    };
  }

  return null;
}

/**
 * Extract all $ references from a value (recursively)
 */
function extractReferences(
  value: unknown,
  sourceId: string,
  path: string,
  refs: BmfReference[]
): void {
  if (typeof value === 'string') {
    let match;
    // Extract $ prefixed references
    REFERENCE_PATTERN_GLOBAL.lastIndex = 0;
    while ((match = REFERENCE_PATTERN_GLOBAL.exec(value)) !== null) {
      const targetType = match[1];
      const targetPath = match[2];
      // Convert $type.epic.name to type:epic:name
      const targetId = `${targetType}:${targetPath.replace(/\./g, ':')}`;
      refs.push({
        source: sourceId,
        target: targetId,
        targetType,
        path: `${path}`
      });
    }
    // Extract bare component references (e.g., in "for each" loops)
    BARE_COMPONENT_PATTERN_GLOBAL.lastIndex = 0;
    while ((match = BARE_COMPONENT_PATTERN_GLOBAL.exec(value)) !== null) {
      const targetPath = match[1];
      const targetId = `component:${targetPath.replace(/\./g, ':')}`;
      refs.push({
        source: sourceId,
        target: targetId,
        targetType: 'component',
        path: `${path}`
      });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      extractReferences(item, sourceId, `${path}[${index}]`, refs);
    });
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, val]) => {
      extractReferences(val, sourceId, `${path}.${key}`, refs);
    });
  }
}

// Raw component shape from YAML
interface RawComponent {
  id?: string;
  type?: string;
  label?: string;
  value?: unknown;
  action?: string;
  icon?: string;
  placeholder?: string;
  default?: unknown;
  when?: string;
  components?: unknown[];
}

/**
 * Parse components from raw YAML
 * @param raw - Raw component array from YAML
 * @param parentId - Parent ID prefix for generating unique component IDs
 */
function parseComponents(raw: unknown[] | undefined, parentId: string = ''): BmfComponent[] {
  if (!raw || !Array.isArray(raw)) return [];

  return raw.map((rawItem, index) => {
    const item = rawItem as RawComponent;
    // Generate unique ID: use explicit id, value (if string), or fallback to parent_index format
    const valueAsId = typeof item.value === 'string' ? item.value : null;
    const compId = item.id || valueAsId || `${parentId}_${index}`;
    // Determine type: explicit type, or 'components' if has nested components, otherwise 'unknown'
    const compType = item.type || (item.components ? 'components' : 'unknown');
    const comp: BmfComponent = {
      id: compId,
      type: compType,
      label: item.label,
      value: item.value,
      action: item.action,
      icon: item.icon,
      placeholder: item.placeholder,
      default: item.default,
      when: item.when,
    };

    if (item.components) {
      comp.components = parseComponents(item.components, compId);
    }

    return comp;
  });
}

/**
 * Parse a BMF YAML string into structured data
 */
export function parseBmfYaml(yamlContent: string): ParsedBmf {
  const parsed = YAML.parse(yamlContent);
  const entities = new Map<string, BmfEntity>();
  const references: BmfReference[] = [];
  const epicsSet = new Set<string>();
  const tagsSet = new Set<string>();

  if (!parsed || typeof parsed !== 'object') {
    return { entities, references, epics: [], tags: [], referencedIds: new Set() };
  }

  // Process each top-level key
  Object.entries(parsed).forEach(([key, value]) => {
    const entityInfo = parseEntityId(key);
    if (!entityInfo || !value || typeof value !== 'object') return;

    const rawValue = value as Record<string, unknown>;
    const entityTags = Array.isArray(rawValue.tags) ? rawValue.tags.filter((t): t is string => typeof t === 'string') : [];

    const entity: BmfEntity = {
      id: key,
      type: entityInfo.type,
      epic: entityInfo.epic,
      name: entityInfo.name,
      description: rawValue.description as string | undefined,
      tags: entityTags,
      components: parseComponents(rawValue.components as unknown[] | undefined, key),
      props: rawValue.props as Record<string, unknown> | undefined,
      data: rawValue.data as Record<string, unknown> | undefined,
      effects: rawValue.effects as unknown[] | undefined,
      layout: rawValue.layout as string | undefined,
      to: rawValue.to as string | undefined,
      raw: rawValue,
    };

    // Collect tags
    entityTags.forEach(tag => tagsSet.add(tag));

    entities.set(key, entity);

    if (entityInfo.epic) {
      epicsSet.add(entityInfo.epic);
    }

    // Extract all references from this entity
    extractReferences(rawValue, key, '', references);
  });

  // Build set of referenced IDs
  const referencedIds = new Set<string>();
  references.forEach(ref => {
    referencedIds.add(ref.target);
  });

  return {
    entities,
    references,
    epics: Array.from(epicsSet).sort(),
    tags: Array.from(tagsSet).sort(),
    referencedIds,
  };
}

/**
 * Parse multiple YAML files (from file input)
 */
export function parseBmfFiles(files: Map<string, string>): ParsedBmf {
  const allEntities = new Map<string, BmfEntity>();
  const allReferences: BmfReference[] = [];
  const allEpics = new Set<string>();
  const allTags = new Set<string>();

  files.forEach((content) => {
    const parsed = parseBmfYaml(content);
    parsed.entities.forEach((entity, id) => {
      allEntities.set(id, entity);
    });
    allReferences.push(...parsed.references);
    parsed.epics.forEach(epic => allEpics.add(epic));
    parsed.tags.forEach(tag => allTags.add(tag));
  });

  // Rebuild referenced IDs from all references
  const referencedIds = new Set<string>();
  allReferences.forEach(ref => {
    referencedIds.add(ref.target);
  });

  return {
    entities: allEntities,
    references: allReferences,
    epics: Array.from(allEpics).sort(),
    tags: Array.from(allTags).sort(),
    referencedIds,
  };
}
