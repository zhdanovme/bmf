// Main navigation graph component using React Flow
import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  MarkerType,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionLineType,
  BaseEdge,
  getBezierPath,
} from '@xyflow/react';
import type { Node, Edge, EdgeProps } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import '@xyflow/react/dist/style.css';

import type { BmfGraph, BmfGraphNode, ReferenceInfo, HiddenRefInfo } from '../types/bmf';
import { BmfNode } from './BmfNode';
import { YamlViewer } from './YamlViewer';
import { FilterOverlay, NO_TAGS_FILTER } from './FilterOverlay';
import { CommentDialog } from './CommentDialog';
import { SearchOverlay } from './SearchOverlay';
import { useBmfStore } from '../store/bmfStore';
import { getTypeColor } from '../utils/colorHash';

interface NavigationGraphProps {
  graph: BmfGraph;
}

// Custom node types
const nodeTypes = {
  bmfNode: BmfNode,
};

// Custom edge component
function BmfEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  markerStart,
  style,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} markerStart={markerStart} style={style} />
  );
}

const edgeTypes = {
  bmfEdge: BmfEdge,
};

// ELK layout engine
const elk = new ELK();

// Node dimensions
const NODE_WIDTH = 300;
const NODE_HEADER_HEIGHT = 50;
const NODE_ELEMENT_HEIGHT = 24;
const NODE_PADDING = 20;
const MIN_NODE_HEIGHT = 80;

// Spacing multiplier for layout density
const SPACING_MULTIPLIER = 2.5;

function calculateNodeHeight(node: BmfGraphNode): number {
  const componentCount = node.components.length;
  if (componentCount === 0) return MIN_NODE_HEIGHT;
  return Math.max(
    MIN_NODE_HEIGHT,
    NODE_HEADER_HEIGHT + (componentCount * NODE_ELEMENT_HEIGHT) + NODE_PADDING
  );
}

// Interface for ELK node with children
interface ElkNode {
  id: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  children?: ElkNode[];
  layoutOptions?: Record<string, string>;
}

// Epic connection analysis types
interface EpicStats {
  epic: string;
  nodeCount: number;
  internalEdges: number;
  externalEdges: number;
  centrality: number;
  connectedEpics: Map<string, number>;
}

// Get ELK options for clustered layout
function getElkOptions(isClusterParent = false): Record<string, string> {
  const s = (base: number) => String(Math.round(base * SPACING_MULTIPLIER));

  const baseOptions = {
    'elk.padding': `[top=${s(50)},left=${s(50)},bottom=${s(50)},right=${s(50)}]`,
  };

  if (isClusterParent) {
    return {
      'elk.padding': `[top=${s(40)},left=${s(20)},bottom=${s(20)},right=${s(20)}]`,
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': s(60),
      'elk.layered.spacing.nodeNodeBetweenLayers': s(150),
    };
  }

  return {
    ...baseOptions,
    'elk.algorithm': 'stress',
    'elk.stress.desiredEdgeLength': s(600),
    'elk.spacing.nodeNode': s(250),
    'elk.spacing.componentComponent': s(200),
  };
}

// Analyze connections between epics
function analyzeEpicConnections(
  nodes: Node[],
  edges: Edge[]
): { epicStats: Map<string, EpicStats>; nodeToEpic: Map<string, string> } {
  const nodeToEpic = new Map<string, string>();
  const epicNodes = new Map<string, Set<string>>();

  nodes.forEach((node) => {
    const epic = (node.data as { epic?: string }).epic || 'Other';
    nodeToEpic.set(node.id, epic);
    if (!epicNodes.has(epic)) {
      epicNodes.set(epic, new Set());
    }
    epicNodes.get(epic)!.add(node.id);
  });

  const epicStats = new Map<string, EpicStats>();

  epicNodes.forEach((nodeSet, epic) => {
    epicStats.set(epic, {
      epic,
      nodeCount: nodeSet.size,
      internalEdges: 0,
      externalEdges: 0,
      centrality: 0,
      connectedEpics: new Map(),
    });
  });

  edges.forEach((edge) => {
    const sourceEpic = nodeToEpic.get(edge.source);
    const targetEpic = nodeToEpic.get(edge.target);

    if (!sourceEpic || !targetEpic) return;

    const sourceStats = epicStats.get(sourceEpic)!;
    const targetStats = epicStats.get(targetEpic)!;

    if (sourceEpic === targetEpic) {
      sourceStats.internalEdges++;
    } else {
      sourceStats.externalEdges++;
      targetStats.externalEdges++;

      const currentSourceToTarget = sourceStats.connectedEpics.get(targetEpic) || 0;
      sourceStats.connectedEpics.set(targetEpic, currentSourceToTarget + 1);

      const currentTargetToSource = targetStats.connectedEpics.get(sourceEpic) || 0;
      targetStats.connectedEpics.set(sourceEpic, currentTargetToSource + 1);
    }
  });

  epicStats.forEach((stats) => {
    stats.centrality = stats.externalEdges * 2 + stats.internalEdges;
  });

  return { epicStats, nodeToEpic };
}

// Community detection using greedy modularity optimization
function detectEpicCommunities(epicStats: Map<string, EpicStats>): Map<string, string[]> {
  const epics = Array.from(epicStats.keys());

  if (epics.length <= 3) {
    return new Map([['main', epics]]);
  }

  const communities = new Map<string, string[]>();
  const assignedEpics = new Set<string>();

  const sortedEpics = [...epics].sort((a, b) => {
    const statsA = epicStats.get(a)!;
    const statsB = epicStats.get(b)!;
    return statsB.centrality - statsA.centrality;
  });

  let communityIndex = 0;

  sortedEpics.forEach((epic) => {
    if (assignedEpics.has(epic)) return;

    const stats = epicStats.get(epic)!;
    const community: string[] = [epic];
    assignedEpics.add(epic);

    const connections = Array.from(stats.connectedEpics.entries())
      .filter(([e]) => !assignedEpics.has(e))
      .sort((a, b) => b[1] - a[1]);

    let addedCount = 0;
    for (const [connectedEpic, count] of connections) {
      if (assignedEpics.has(connectedEpic)) continue;

      if (count >= 3 || addedCount < 2) {
        community.push(connectedEpic);
        assignedEpics.add(connectedEpic);
        addedCount++;
      }

      if (community.length >= 4) break;
    }

    communities.set(`community-${communityIndex}`, community);
    communityIndex++;
  });

  return communities;
}

// Main layout function - uses clustered layout with smart epic grouping
async function getClusteredLayout(
  nodes: Node[],
  edges: Edge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const { epicStats, nodeToEpic } = analyzeEpicConnections(nodes, edges);
  const communities = detectEpicCommunities(epicStats);

  console.log('Epic Analysis:', {
    epics: Array.from(epicStats.entries()).map(([epic, stats]) => ({
      epic,
      nodeCount: stats.nodeCount,
      internal: stats.internalEdges,
      external: stats.externalEdges,
      centrality: stats.centrality,
      connections: Object.fromEntries(stats.connectedEpics),
    })),
    communities: Object.fromEntries(communities),
  });

  const epicGroups = new Map<string, Node[]>();

  nodes.forEach((node) => {
    const epic = nodeToEpic.get(node.id) || 'Other';
    if (!epicGroups.has(epic)) {
      epicGroups.set(epic, []);
    }
    epicGroups.get(epic)!.push(node);
  });

  const hasSuperClusters = communities.size > 1;
  const s = (base: number) => String(Math.round(base * SPACING_MULTIPLIER));

  let rootChildren: ElkNode[];

  if (hasSuperClusters) {
    rootChildren = [];

    const sortedCommunities = Array.from(communities.entries()).sort((a, b) => {
      const totalA = a[1].reduce((sum, epic) => sum + (epicStats.get(epic)?.centrality || 0), 0);
      const totalB = b[1].reduce((sum, epic) => sum + (epicStats.get(epic)?.centrality || 0), 0);
      return totalB - totalA;
    });

    sortedCommunities.forEach(([communityId, epicList]) => {
      const sortedEpics = [...epicList].sort((a, b) => {
        const statsA = epicStats.get(a);
        const statsB = epicStats.get(b);
        return (statsB?.centrality || 0) - (statsA?.centrality || 0);
      });

      const epicClusters: ElkNode[] = sortedEpics.map((epic) => {
        const groupNodes = epicGroups.get(epic) || [];
        const children = groupNodes.map((node) => {
          const height = calculateNodeHeight(node.data as unknown as BmfGraphNode);
          return {
            id: node.id,
            width: NODE_WIDTH,
            height,
          };
        });

        return {
          id: `cluster:${epic}`,
          layoutOptions: getElkOptions(true),
          children,
        };
      });

      rootChildren.push({
        id: `supercluster:${communityId}`,
        layoutOptions: {
          'elk.padding': `[top=${s(60)},left=${s(40)},bottom=${s(40)},right=${s(40)}]`,
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': s(150),
          'elk.layered.spacing.nodeNodeBetweenLayers': s(200),
        },
        children: epicClusters,
      });
    });
  } else {
    const sortedEpics = Array.from(epicGroups.keys()).sort((a, b) => {
      const statsA = epicStats.get(a);
      const statsB = epicStats.get(b);
      return (statsB?.centrality || 0) - (statsA?.centrality || 0);
    });

    rootChildren = sortedEpics.map((epic) => {
      const groupNodes = epicGroups.get(epic) || [];
      const children = groupNodes.map((node) => {
        const height = calculateNodeHeight(node.data as unknown as BmfGraphNode);
        return {
          id: node.id,
          width: NODE_WIDTH,
          height,
        };
      });

      return {
        id: `cluster:${epic}`,
        layoutOptions: getElkOptions(true),
        children,
      };
    });
  }

  const elkEdges = edges.map((edge) => {
    const sourceEpic = nodeToEpic.get(edge.source);
    const targetEpic = nodeToEpic.get(edge.target);
    const isCrossEpic = sourceEpic !== targetEpic;

    return {
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
      ...(isCrossEpic ? { layoutOptions: { 'elk.priority': '2' } } : {}),
    };
  });

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      ...getElkOptions(false),
      'elk.stress.desiredEdgeLength': s(hasSuperClusters ? 800 : 600),
    },
    children: rootChildren,
    edges: elkEdges,
  };

  const layoutedGraph = await elk.layout(elkGraph);

  const nodePositions = new Map<string, { x: number; y: number }>();

  function extractPositions(container: ElkNode, offsetX = 0, offsetY = 0) {
    const x = offsetX + (container.x ?? 0);
    const y = offsetY + (container.y ?? 0);

    container.children?.forEach((child) => {
      if (child.children && child.children.length > 0) {
        extractPositions(child, x, y);
      } else {
        nodePositions.set(child.id, {
          x: x + (child.x ?? 0),
          y: y + (child.y ?? 0),
        });
      }
    });
  }

  layoutedGraph.children?.forEach((child) => {
    extractPositions(child);
  });

  const layoutedNodes = nodes.map((node) => {
    const pos = nodePositions.get(node.id) ?? { x: 0, y: 0 };
    return {
      ...node,
      position: pos,
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Inner component with React Flow context
function NavigationGraphInner({ graph }: NavigationGraphProps) {
  const [isLayouting, setIsLayouting] = useState(false);
  const { fitView, getNodes, setCenter } = useReactFlow();

  // Track the last layout key to detect when we need to re-layout vs just update data
  const lastLayoutKeyRef = useRef<string | null>(null);

  const selectedNodeId = useBmfStore((s) => s.selectedNodeId);
  const connectedNodes = useBmfStore((s) => s.connectedNodes);
  const selectNode = useBmfStore((s) => s.selectNode);
  const hiddenTypes = useBmfStore((s) => s.hiddenTypes);
  const hiddenEpics = useBmfStore((s) => s.hiddenEpics);
  const hiddenTags = useBmfStore((s) => s.hiddenTags);
  const hoveredFilter = useBmfStore((s) => s.hoveredFilter);
  const openCommentDialog = useBmfStore((s) => s.openCommentDialog);
  const commentDialogOpen = useBmfStore((s) => s.commentDialogOpen);
  const comments = useBmfStore((s) => s.comments);
  const openSearch = useBmfStore((s) => s.openSearch);
  const searchOpen = useBmfStore((s) => s.searchOpen);

  // Navigate to node (center view on it)
  const navigateToNode = useCallback((nodeId: string) => {
    const rfNodes = getNodes();
    const targetNode = rfNodes.find(n => n.id === nodeId);

    if (targetNode) {
      const nodeData = targetNode.data as unknown as BmfGraphNode;
      const nodeHeight = calculateNodeHeight(nodeData);
      const centerX = targetNode.position.x + NODE_WIDTH / 2;
      const centerY = targetNode.position.y + nodeHeight / 2;
      setCenter(centerX, centerY, { zoom: 1, duration: 500 });
    }
  }, [getNodes, setCenter]);

  // Keyboard handler for 'C' to open comment dialog and Cmd+F for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F or Ctrl+F opens search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        if (!searchOpen) {
          openSearch();
        }
        return;
      }

      // Don't trigger other shortcuts if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Use e.code to check physical key (works with any keyboard layout)
      if (e.code === 'KeyC' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (selectedNodeId && !commentDialogOpen) {
          e.preventDefault();
          openCommentDialog();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, commentDialogOpen, openCommentDialog, searchOpen, openSearch]);

  // Handle node title click (open YAML viewer)
  const handleTitleClick = useCallback((nodeId: string) => {
    selectNode(nodeId);
  }, [selectNode]);

  // Handle reference click (navigate to target)
  const handleReferenceClick = useCallback((targetId: string) => {
    // Find target node in React Flow state to get actual position
    const rfNodes = getNodes();
    const targetNode = rfNodes.find(n => n.id === targetId);

    if (targetNode) {
      // Get node data to calculate center
      const nodeData = targetNode.data as unknown as BmfGraphNode;
      const nodeHeight = calculateNodeHeight(nodeData);

      // Calculate center of the node
      const centerX = targetNode.position.x + NODE_WIDTH / 2;
      const centerY = targetNode.position.y + nodeHeight / 2;

      // Smoothly pan to center on the target node
      setCenter(centerX, centerY, { zoom: 1, duration: 500 });

      // Select the target node to show its details
      selectNode(targetId);
    }
  }, [getNodes, setCenter, selectNode]);

  // Close YAML viewer
  const closeViewer = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // All node IDs in the graph (before filtering)
  const allNodeIds = useMemo(() => {
    return new Set(graph.nodes.map((node) => node.id));
  }, [graph.nodes]);

  // Node ID to node data map for quick lookup
  const nodeById = useMemo(() => {
    const map = new Map<string, BmfGraphNode>();
    graph.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [graph.nodes]);

  // Filter nodes based on hidden types/epics/tags
  const visibleNodeIds = useMemo(() => {
    const visible = new Set<string>();
    graph.nodes.forEach((node) => {
      const isTypeHidden = hiddenTypes.has(node.type);
      const isEpicHidden = node.epic && hiddenEpics.has(node.epic);
      // Hide if any of node's tags is in hiddenTags
      const isTagHidden = node.tags.length > 0 && node.tags.some(tag => hiddenTags.has(tag));
      // Hide if node has no tags and NO_TAGS_FILTER is hidden
      const isNoTagsHidden = node.tags.length === 0 && hiddenTags.has(NO_TAGS_FILTER);
      if (!isTypeHidden && !isEpicHidden && !isTagHidden && !isNoTagsHidden) {
        visible.add(node.id);
      }
    });
    return visible;
  }, [graph.nodes, hiddenTypes, hiddenEpics, hiddenTags]);

  // Compute reference info for each component (status: connected/hidden/broken)
  const computeReferenceInfo = useCallback((node: BmfGraphNode): Map<string, ReferenceInfo> => {
    const refInfo = new Map<string, ReferenceInfo>();

    node.components.forEach((comp) => {
      if (!comp.reference) return;

      const targetId = comp.reference;

      if (!allNodeIds.has(targetId)) {
        // Target doesn't exist in graph - broken reference
        refInfo.set(comp.id, { status: 'broken' });
      } else if (!visibleNodeIds.has(targetId)) {
        // Target exists but is hidden by filters
        const targetNode = nodeById.get(targetId);
        const targetName = targetNode?.name || targetId.split(':').pop() || targetId;
        refInfo.set(comp.id, {
          status: 'hidden',
          targetName,
          targetId,
          targetType: targetNode?.type
        });
      } else {
        // Target is visible and connected
        const connectedNode = nodeById.get(targetId);
        refInfo.set(comp.id, {
          status: 'connected',
          targetId,
          targetType: connectedNode?.type
        });
      }
    });

    return refInfo;
  }, [allNodeIds, visibleNodeIds, nodeById]);

  // Handle click on hidden reference badge - select the hidden node and show YAML viewer
  const handleHiddenReferenceClick = useCallback((targetId: string) => {
    selectNode(targetId);
  }, [selectNode]);

  // Compute hidden references for each node (both incoming and outgoing)
  const { incomingHiddenRefs, outgoingHiddenRefs } = useMemo(() => {
    const incoming = new Map<string, HiddenRefInfo[]>(); // nodeId -> hidden nodes that reference it
    const outgoing = new Map<string, HiddenRefInfo[]>(); // nodeId -> hidden targets it references

    // For each node in the graph
    graph.nodes.forEach((node) => {
      const nodeIsVisible = visibleNodeIds.has(node.id);

      // Check each component's reference
      node.components.forEach((comp) => {
        if (!comp.reference) return;
        const targetId = comp.reference;

        // Skip if target doesn't exist in graph
        if (!allNodeIds.has(targetId)) return;

        const targetIsVisible = visibleNodeIds.has(targetId);
        const targetNode = nodeById.get(targetId);

        if (nodeIsVisible && !targetIsVisible && targetNode) {
          // Source is visible, target is hidden -> add to outgoing
          if (!outgoing.has(node.id)) outgoing.set(node.id, []);
          const existing = outgoing.get(node.id)!;
          // Avoid duplicates
          if (!existing.some(r => r.nodeId === targetId)) {
            existing.push({
              nodeId: targetId,
              nodeName: targetNode.name || targetId.split(':').pop() || targetId,
              nodeType: targetNode.type
            });
          }
        }

        if (!nodeIsVisible && targetIsVisible) {
          // Source is hidden, target is visible -> add to incoming
          if (!incoming.has(targetId)) incoming.set(targetId, []);
          const existing = incoming.get(targetId)!;
          // Avoid duplicates
          if (!existing.some(r => r.nodeId === node.id)) {
            existing.push({
              nodeId: node.id,
              nodeName: node.name || node.id.split(':').pop() || node.id,
              nodeType: node.type
            });
          }
        }
      });
    });

    return { incomingHiddenRefs: incoming, outgoingHiddenRefs: outgoing };
  }, [graph.nodes, visibleNodeIds, allNodeIds, nodeById]);

  // Build initial nodes and edges
  const { rawNodes, rawEdges } = useMemo(() => {
    const rawNodes: Node[] = graph.nodes
      .filter((node) => visibleNodeIds.has(node.id))
      .map((node) => ({
        id: node.id,
        type: 'bmfNode',
        data: {
          ...node,
          onTitleClick: handleTitleClick,
          onReferenceClick: handleReferenceClick,
          onHiddenReferenceClick: handleHiddenReferenceClick,
          referenceInfo: computeReferenceInfo(node),
          incomingHiddenRefs: incomingHiddenRefs.get(node.id) || [],
          outgoingHiddenRefs: outgoingHiddenRefs.get(node.id) || [],
          hasComment: comments.has(node.id),
        },
        position: { x: 0, y: 0 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      }));

    const rawEdges: Edge[] = graph.edges
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => {
        const targetColor = getTypeColor(edge.targetType);

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceElement || 'source',
          targetHandle: 'target',
          type: 'bmfEdge',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: targetColor,
            width: 16,
            height: 16,
          },
          style: {
            stroke: targetColor,
            strokeWidth: 1,
          },
        };
      });

    return { rawNodes, rawEdges };
  }, [graph, visibleNodeIds, handleTitleClick, handleReferenceClick, handleHiddenReferenceClick, computeReferenceInfo, incomingHiddenRefs, outgoingHiddenRefs, comments]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Create a layout key that only changes when graph structure changes (not comments)
  const layoutKey = useMemo(() => {
    const nodeIds = rawNodes.map(n => n.id).sort().join(',');
    const edgeIds = rawEdges.map(e => e.id).sort().join(',');
    return `${nodeIds}|${edgeIds}`;
  }, [rawNodes, rawEdges]);

  // Apply ELK layout
  useEffect(() => {
    const needsLayout = lastLayoutKeyRef.current !== layoutKey;
    const isInitialLayout = lastLayoutKeyRef.current === null;

    if (!needsLayout) {
      // Only update node data (e.g., hasComment changed), preserve positions
      setNodes(prevNodes => {
        const dataMap = new Map(rawNodes.map(n => [n.id, n.data]));
        return prevNodes.map(node => ({
          ...node,
          data: dataMap.get(node.id) || node.data,
        }));
      });
      return;
    }

    lastLayoutKeyRef.current = layoutKey;
    let cancelled = false;
    setIsLayouting(true);

    getClusteredLayout(rawNodes, rawEdges)
      .then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
        if (!cancelled) {
          setNodes(layoutedNodes);
          setEdges(layoutedEdges);
          setIsLayouting(false);
          // Only fit view on initial layout or when graph structure changes
          if (isInitialLayout) {
            setTimeout(() => fitView({ padding: 0.2 }), 100);
          }
        }
      })
      .catch((err) => {
        console.error('Layout error:', err);
        if (!cancelled) {
          setNodes(rawNodes);
          setEdges(rawEdges);
          setIsLayouting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rawNodes, rawEdges, layoutKey, setNodes, setEdges, fitView]);

  // Generate dimming styles when a node is selected
  const dimmingStyles = useMemo(() => {
    if (!selectedNodeId || connectedNodes.size === 0) return '';

    const dimmingSelectors = graph.nodes
      .filter(n => !connectedNodes.has(n.id))
      .map(n => `.react-flow__node[data-id="${n.id}"]`)
      .join(', ');

    const edgeDimmingSelectors = graph.edges
      .filter(e => !connectedNodes.has(e.source) && !connectedNodes.has(e.target))
      .map(e => `.react-flow__edge[data-id="${e.id}"]`)
      .join(', ');

    let css = '';
    if (dimmingSelectors) {
      css += `${dimmingSelectors} { opacity: 0.25; transition: opacity 0.2s ease; }\n`;
    }
    if (edgeDimmingSelectors) {
      css += `${edgeDimmingSelectors} { opacity: 0.25; transition: opacity 0.2s ease; }\n`;
    }
    return css;
  }, [selectedNodeId, connectedNodes, graph]);

  // Generate dimming styles when hovering over a filter
  const filterHoverStyles = useMemo(() => {
    if (!hoveredFilter) return '';

    // Find nodes that DON'T match the hovered filter
    const nonMatchingNodes = graph.nodes.filter(n => {
      // Only consider visible nodes
      if (!visibleNodeIds.has(n.id)) return false;

      if (hoveredFilter.category === 'type') {
        return n.type !== hoveredFilter.value;
      } else if (hoveredFilter.category === 'epic') {
        return n.epic !== hoveredFilter.value;
      } else if (hoveredFilter.category === 'tag') {
        // Special case for "no tags" filter
        if (hoveredFilter.value === NO_TAGS_FILTER) {
          return n.tags.length > 0; // Dim nodes that HAVE tags
        }
        return !n.tags.includes(hoveredFilter.value);
      }
      return false;
    });

    if (nonMatchingNodes.length === 0) return '';

    const nodeSelectors = nonMatchingNodes
      .map(n => `.react-flow__node[data-id="${n.id}"]`)
      .join(', ');

    // Also dim edges that don't connect to matching nodes
    const matchingNodeIds = new Set(
      graph.nodes
        .filter(n => visibleNodeIds.has(n.id) && !nonMatchingNodes.some(nm => nm.id === n.id))
        .map(n => n.id)
    );

    const nonMatchingEdges = graph.edges.filter(e =>
      visibleNodeIds.has(e.source) &&
      visibleNodeIds.has(e.target) &&
      !matchingNodeIds.has(e.source) &&
      !matchingNodeIds.has(e.target)
    );

    const edgeSelectors = nonMatchingEdges
      .map(e => `.react-flow__edge[data-id="${e.id}"]`)
      .join(', ');

    let css = '';
    if (nodeSelectors) {
      css += `${nodeSelectors} { opacity: 0.2; filter: saturate(0.3); transition: opacity 0.15s ease, filter 0.15s ease; }\n`;
    }
    if (edgeSelectors) {
      css += `${edgeSelectors} { opacity: 0.15; transition: opacity 0.15s ease; }\n`;
    }
    return css;
  }, [hoveredFilter, graph, visibleNodeIds]);

  // Handle node click
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id);
  }, [selectNode]);

  // Handle node drag start - select node when dragging begins
  const onNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id);
  }, [selectNode]);

  return (
    <div className="navigation-graph">
      {(dimmingStyles || filterHoverStyles) && <style>{dimmingStyles}{filterHoverStyles}</style>}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        connectionLineType={ConnectionLineType.Bezier}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#1e293b" gap={20} />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as unknown as BmfGraphNode;
            return getTypeColor(data.type);
          }}
          style={{ background: '#0f172a' }}
        />
      </ReactFlow>

      {/* Loading indicator */}
      {isLayouting && (
        <div className="graph-loading">
          <span>Layouting graph...</span>
        </div>
      )}

      {/* Filter Overlay */}
      <FilterOverlay />

      {/* Search Overlay */}
      <SearchOverlay onNavigateToNode={navigateToNode} />

      {/* YAML Viewer panel */}
      {selectedNodeId && (
        <YamlViewer nodeId={selectedNodeId} onClose={closeViewer} />
      )}

      {/* Comment Dialog */}
      <CommentDialog />
    </div>
  );
}

// Wrapper with ReactFlowProvider
export function NavigationGraph({ graph }: NavigationGraphProps) {
  return (
    <ReactFlowProvider>
      <NavigationGraphInner graph={graph} />
    </ReactFlowProvider>
  );
}
