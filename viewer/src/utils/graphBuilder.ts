// Build navigation graph from parsed BMF data
import type {
  ParsedBmf,
  BmfComponent,
  BmfGraph,
  BmfGraphNode,
  BmfGraphEdge,
  FlatComponent,
} from '../types/bmf';
import { extractReference } from './patterns';

/**
 * Extract components from if-then-else conditions
 */
function extractConditionComponents(
  conditions: unknown[],
  parentId: string,
  depth: number
): FlatComponent[] {
  const result: FlatComponent[] = [];
  let condIndex = 0;

  for (const cond of conditions) {
    if (typeof cond === 'string') {
      // Direct reference string
      const ref = extractReference(cond);
      if (ref) {
        result.push({
          id: `${parentId}_effect_${condIndex}`,
          type: 'effect',
          label: cond,
          depth,
          reference: ref.reference,
          referenceType: ref.referenceType,
        });
      }
      condIndex++;
    } else if (cond && typeof cond === 'object' && 'if' in cond) {
      // If-then-else condition
      const condObj = cond as { if: string; then?: unknown; else?: unknown };
      const condId = `${parentId}_cond_${condIndex}`;

      // Add the condition itself
      result.push({
        id: condId,
        type: 'condition',
        label: `if: ${condObj.if}`,
        depth,
      });

      // Process "then" branch
      if (condObj.then) {
        const thenBranch = Array.isArray(condObj.then) ? condObj.then : [condObj.then];
        result.push({
          id: `${condId}_then`,
          type: 'then',
          label: 'then',
          depth: depth + 1,
        });
        result.push(...extractConditionComponents(thenBranch, `${condId}_then`, depth + 2));
      }

      // Process "else" branch
      if (condObj.else) {
        const elseBranch = Array.isArray(condObj.else) ? condObj.else : [condObj.else];
        result.push({
          id: `${condId}_else`,
          type: 'else',
          label: 'else',
          depth: depth + 1,
        });
        result.push(...extractConditionComponents(elseBranch, `${condId}_else`, depth + 2));
      }

      condIndex++;
    }
  }

  return result;
}

/**
 * Flatten components recursively with depth tracking
 * Components are already inlined via YAML anchors at parse time
 */
function flattenComponents(
  components: BmfComponent[] | undefined,
  depth: number = 0
): FlatComponent[] {
  if (!components) return [];

  const result: FlatComponent[] = [];

  for (const comp of components) {
    // Extract reference from action or value
    let reference: string | undefined;
    let referenceType: string | undefined;

    const valueToCheck = comp.action || (typeof comp.value === 'string' ? comp.value : undefined);
    if (valueToCheck) {
      const ref = extractReference(valueToCheck);
      if (ref) {
        reference = ref.reference;
        referenceType = ref.referenceType;
      }
    }

    result.push({
      id: comp.id,
      type: comp.type,
      label: comp.label,
      depth,
      reference,
      referenceType,
    });

    // Process trigger value (array of if-then conditions)
    if (comp.type === 'trigger' && Array.isArray(comp.value)) {
      result.push(...extractConditionComponents(comp.value, comp.id, depth + 1));
    }

    // Recursively add nested components (already inlined via YAML anchors)
    if (comp.components) {
      result.push(...flattenComponents(comp.components, depth + 1));
    }
  }

  return result;
}

/**
 * Extract flat components from entity effects (for actions/events)
 */
function flattenEffects(
  effects: unknown[] | undefined,
  entityId: string
): FlatComponent[] {
  if (!effects || !Array.isArray(effects)) return [];
  return extractConditionComponents(effects, entityId, 0);
}

/**
 * Build the navigation graph from parsed BMF data
 */
export function buildGraph(parsed: ParsedBmf): BmfGraph {
  const nodes: BmfGraphNode[] = [];
  const edges: BmfGraphEdge[] = [];
  const edgeSet = new Set<string>(); // Prevent duplicate edges

  // Build map of entity ID to outgoing edges (Map<targetId, componentId>)
  const outgoingEdges = new Map<string, Map<string, string>>();

  // First pass: identify which entities should be nodes
  // An entity is displayed if:
  // - It has components or effects
  // - It is referenced by another entity
  // - BUT NOT if it's a "component" type entity (those get inlined)
  const visibleEntities = new Set<string>();

  parsed.entities.forEach((entity, id) => {
    // Component type entities are inlined, not shown as separate nodes
    if (entity.type === 'component') return;

    const hasComponents = entity.components && entity.components.length > 0;
    const hasEffects = entity.effects && entity.effects.length > 0;
    const isReferenced = parsed.referencedIds.has(id);

    if (hasComponents || hasEffects || isReferenced) {
      visibleEntities.add(id);
    }
  });

  // Second pass: build nodes and collect edges
  parsed.entities.forEach((entity, id) => {
    if (!visibleEntities.has(id)) return;

    // Combine components and effects into flat components
    // Components are already inlined via YAML anchors at parse time
    const flatComponents = [
      ...flattenComponents(entity.components, 0),
      ...flattenEffects(entity.effects, id),
    ];

    nodes.push({
      id,
      type: entity.type,
      epic: entity.epic,
      name: entity.name,
      description: entity.description,
      tags: entity.tags || [],
      components: flatComponents,
      hasComponents: (entity.components?.length ?? 0) > 0 || (entity.effects?.length ?? 0) > 0,
      isReferenced: parsed.referencedIds.has(id),
    });

    // Track outgoing edges for this entity: Map<targetId, componentId>
    const outgoing = new Map<string, string>();

    // Build edges from component references
    flatComponents.forEach((comp) => {
      if (comp.reference) {
        // Only create edge if target is a visible entity
        if (visibleEntities.has(comp.reference)) {
          // Store component ID for sourceElement (first component wins for duplicates)
          if (!outgoing.has(comp.reference)) {
            outgoing.set(comp.reference, comp.id);
          }
        }
      }
    });

    outgoingEdges.set(id, outgoing);
  });

  // Third pass: create edges
  outgoingEdges.forEach((targets, sourceId) => {
    targets.forEach((componentId, targetId) => {
      const edgeKey = `${sourceId}->${targetId}`;
      if (edgeSet.has(edgeKey)) return;
      edgeSet.add(edgeKey);

      const targetEntity = parsed.entities.get(targetId);

      edges.push({
        id: edgeKey,
        source: sourceId,
        target: targetId,
        sourceElement: componentId,
        targetType: targetEntity?.type || 'unknown',
      });
    });
  });

  // Also add edges from the references that weren't captured by components
  parsed.references.forEach((ref) => {
    // Skip if source is not visible
    if (!visibleEntities.has(ref.source)) return;

    // Skip if target is not visible
    if (!visibleEntities.has(ref.target)) return;

    const edgeKey = `${ref.source}->${ref.target}`;
    if (edgeSet.has(edgeKey)) return;
    edgeSet.add(edgeKey);

    const targetEntity = parsed.entities.get(ref.target);

    edges.push({
      id: edgeKey,
      source: ref.source,
      target: ref.target,
      targetType: targetEntity?.type || ref.targetType,
    });
  });

  return { nodes, edges };
}

/**
 * Get connected node IDs for a given node (for dimming)
 */
export function getConnectedNodes(nodeId: string, edges: BmfGraphEdge[]): Set<string> {
  const connected = new Set<string>();
  connected.add(nodeId);

  edges.forEach((edge) => {
    if (edge.source === nodeId) {
      connected.add(edge.target);
    }
    if (edge.target === nodeId) {
      connected.add(edge.source);
    }
  });

  return connected;
}
