// BMF Entity Types

export type BmfEntityType =
  | 'screen'
  | 'dialog'
  | 'event'
  | 'action'
  | 'component'
  | 'layout'
  | 'entity'
  | 'context';

export interface BmfComponent {
  id: string;
  type: string;
  label?: string;
  value?: unknown;
  action?: string;
  icon?: string;
  placeholder?: string;
  default?: unknown;
  when?: string;
  components?: BmfComponent[];
}

export interface BmfEntity {
  id: string;
  type: BmfEntityType;
  epic: string;
  name: string;
  description?: string;
  components?: BmfComponent[];
  props?: Record<string, unknown>;
  data?: Record<string, unknown>;
  effects?: unknown[];
  layout?: string;
  to?: string;
  raw: Record<string, unknown>;
}

export interface BmfReference {
  source: string;
  target: string;
  targetType: string;
  path: string;
}

export interface ParsedBmf {
  entities: Map<string, BmfEntity>;
  references: BmfReference[];
  epics: string[];
  referencedIds: Set<string>;
}

// Graph types
export interface FlatComponent {
  id: string;
  type: string;
  label?: string;
  depth: number;
  reference?: string;
  referenceType?: string;
}

export interface BmfGraphNode {
  id: string;
  type: BmfEntityType;
  epic: string;
  name: string;
  description?: string;
  components: FlatComponent[];
  hasComponents: boolean;
  isReferenced: boolean;
}

export interface BmfGraphEdge {
  id: string;
  source: string;
  target: string;
  sourceElement?: string;
  targetType: string;
}

export interface BmfGraph {
  nodes: BmfGraphNode[];
  edges: BmfGraphEdge[];
}
