import fs from 'fs';
import YAML from 'yaml';

const ENTITY_TYPES = new Set([
  'screen', 'dialog', 'event', 'action', 'component', 'layout', 'entity', 'context'
]);

function parseEntityId(key) {
  const parts = key.split(':');
  if (parts.length === 1) {
    if (ENTITY_TYPES.has(parts[0])) {
      return { type: parts[0], epic: '', name: parts[0] };
    }
    return null;
  }
  if (parts.length >= 2) {
    const type = parts[0];
    if (!ENTITY_TYPES.has(type)) return null;
    if (parts.length === 2) {
      return { type, epic: '', name: parts[1] };
    }
    return { type, epic: parts[1], name: parts.slice(2).join(':') };
  }
  return null;
}

const REFERENCE_PATTERN = /\$([a-z]+)\.([a-z0-9._:-]+)/gi;

function extractReferences(value, sourceId, path, refs) {
  if (typeof value === 'string') {
    let match;
    REFERENCE_PATTERN.lastIndex = 0;
    while ((match = REFERENCE_PATTERN.exec(value)) !== null) {
      const targetType = match[1];
      const targetPath = match[2];
      const targetId = `${targetType}:${targetPath.replace(/\./g, ':')}`;
      refs.push({ source: sourceId, target: targetId, targetType, path });
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

const content = fs.readFileSync('../tests/spec.yaml', 'utf-8');
const parsed = YAML.parse(content);

// Parse entities
const entities = new Map();
const references = [];

Object.entries(parsed).forEach(([key, value]) => {
  const entityInfo = parseEntityId(key);
  if (!entityInfo || !value || typeof value !== 'object') return;

  entities.set(key, {
    id: key,
    type: entityInfo.type,
    epic: entityInfo.epic,
    name: entityInfo.name,
    components: value.components || [],
    raw: value
  });

  extractReferences(value, key, '', references);
});

// Build referenced IDs
const referencedIds = new Set();
references.forEach(ref => referencedIds.add(ref.target));

// Build visible entities
let withComponents = 0;
let isReferenced = 0;
let visibleEntities = [];

entities.forEach((entity, id) => {
  const hasComponents = entity.components && entity.components.length > 0;
  const isRef = referencedIds.has(id);

  if (hasComponents) withComponents++;
  if (isRef) isReferenced++;

  if (hasComponents || isRef) {
    visibleEntities.push(id);
  }
});

console.log('Total entities:', entities.size);
console.log('With components:', withComponents);
console.log('Referenced:', isReferenced);
console.log('Visible (has components OR referenced):', visibleEntities.length);
console.log('\nFirst 10 visible entities:', visibleEntities.slice(0, 10));
console.log('\nSample referenced IDs:', [...referencedIds].slice(0, 10));
