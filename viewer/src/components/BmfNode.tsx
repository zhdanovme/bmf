// Custom React Flow node for BMF entities
import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { BmfGraphNode, FlatComponent } from '../types/bmf';
import { getTypeColor, getEpicColor, getLightColor } from '../utils/colorHash';

interface BmfNodeData extends BmfGraphNode {
  onTitleClick?: (nodeId: string) => void;
  onReferenceClick?: (targetId: string) => void;
  hasComment?: boolean;
}

interface BmfNodeProps {
  data: BmfNodeData;
}

interface ComponentRowProps {
  component: FlatComponent;
  onReferenceClick?: (targetId: string) => void;
}

function ComponentRow({ component, onReferenceClick }: ComponentRowProps) {
  const indent = component.depth * 12;

  return (
    <div
      className="bmf-component-row"
      style={{ marginLeft: indent }}
      title={component.reference || component.label || component.id}
    >
      <span className="bmf-component-type">{component.type}</span>
      <span className="bmf-component-label">
        {component.label || component.id}
      </span>
      {component.depth > 0 && (
        <span className="bmf-component-depth">{component.depth}</span>
      )}
      {component.reference && (
        <>
          <span
            className="bmf-component-reference"
            onClick={(e) => {
              e.stopPropagation();
              onReferenceClick?.(component.reference!);
            }}
            title={`Navigate to ${component.reference}`}
          >
            {component.referenceType}
          </span>
          <span className="bmf-component-arrow">→</span>
          <Handle
            type="source"
            position={Position.Right}
            id={component.id}
            className="bmf-component-handle"
          />
        </>
      )}
    </div>
  );
}

function BmfNodeComponent({ data }: BmfNodeProps) {
  const typeColor = useMemo(() => getTypeColor(data.type), [data.type]);
  const epicColor = useMemo(() => getEpicColor(data.epic), [data.epic]);

  const headerStyle = useMemo(() => ({
    background: `linear-gradient(135deg, ${getLightColor(epicColor, 0.4)} 0%, ${getLightColor(epicColor, 0.2)} 100%)`,
    borderBottom: `2px solid ${epicColor}`,
  }), [epicColor]);

  const nodeStyle = useMemo(() => ({
    borderColor: typeColor,
  }), [typeColor]);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onTitleClick?.(data.id);
  };

  // Parse id to get just the name part (last segment)
  const idParts = data.id.split(':');
  const idName = idParts[idParts.length - 1];
  const shortId = idParts.length > 2 ? `${idParts.slice(2).join(':')}` : idName;

  // Check if node is an orphan (not referenced by anyone)
  const isOrphan = !data.isReferenced;

  return (
    <div className={`bmf-node ${isOrphan ? 'bmf-node-orphan' : ''}`} style={nodeStyle}>
      {/* Comment indicator */}
      {data.hasComment && (
        <div className="bmf-node-comment-indicator" title="Has comment">C</div>
      )}

      {/* Target handle on left */}
      <Handle type="target" position={Position.Left} id="target" />

      {/* Header with draggable area */}
      <div
        className="bmf-node-header"
        style={headerStyle}
        onClick={handleTitleClick}
      >
        <span className="bmf-node-type-badge" style={{ backgroundColor: typeColor }}>
          {data.type}
        </span>
        {data.epic && (
          <span className="bmf-node-epic-badge" style={{ backgroundColor: epicColor }}>
            {data.epic}
          </span>
        )}
        <span className="bmf-node-title" title={data.id}>
          {shortId}
        </span>
      </div>

      {/* Description if present */}
      {data.description && (
        <div className="bmf-node-description">{data.description}</div>
      )}

      {/* Components list */}
      {data.components.length > 0 && (
        <div className="bmf-node-components">
          {data.components.map((comp, idx) => (
            <ComponentRow
              key={`${comp.id}-${idx}`}
              component={comp}
              onReferenceClick={data.onReferenceClick}
            />
          ))}
        </div>
      )}

      {/* Default source handle if no components with references */}
      {data.components.every(c => !c.reference) && (
        <Handle type="source" position={Position.Right} id="source" />
      )}
    </div>
  );
}

export const BmfNode = memo(BmfNodeComponent);
