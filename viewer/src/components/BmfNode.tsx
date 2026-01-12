// Custom React Flow node for BMF entities
import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { BmfGraphNode, FlatComponent, ReferenceInfo, HiddenRefInfo } from '../types/bmf';
import { getTypeColor, getEpicColor, getLightColor } from '../utils/colorHash';

// Eye-off icon for hidden references
function EyeOffIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginRight: 4, flexShrink: 0 }}
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M1 1l22 22" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

interface BmfNodeData extends BmfGraphNode {
  onTitleClick?: (nodeId: string) => void;
  onReferenceClick?: (targetId: string) => void;
  onHiddenReferenceClick?: (targetId: string) => void;
  referenceInfo?: Map<string, ReferenceInfo>;
  incomingHiddenRefs?: HiddenRefInfo[];
  outgoingHiddenRefs?: HiddenRefInfo[];
  hasComment?: boolean;
}

interface BmfNodeProps {
  data: BmfNodeData;
}

interface ComponentRowProps {
  component: FlatComponent;
  onReferenceClick?: (targetId: string) => void;
  onHiddenReferenceClick?: (targetId: string) => void;
  refInfo?: ReferenceInfo;
}

function ComponentRow({ component, onReferenceClick, onHiddenReferenceClick, refInfo }: ComponentRowProps) {
  const indent = component.depth * 12;

  // Determine what to show based on reference status
  const status = refInfo?.status;
  const isBroken = status === 'broken';
  const isHidden = status === 'hidden';
  const isConnected = status === 'connected';

  // Get target type color for hidden badge
  const targetTypeColor = refInfo?.targetType ? getTypeColor(refInfo.targetType) : '#f59e0b';

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
          {/* Broken reference: show broken badge with X */}
          {isBroken && (
            <span
              className="bmf-component-reference bmf-reference-broken"
              title={`Broken reference: ${component.reference}`}
            >
              {component.reference}
              <span className="bmf-reference-broken-indicator">✕</span>
            </span>
          )}

          {/* Connected or Hidden: show handle and inline badge */}
          {(isConnected || isHidden) && (
            <>
              <Handle
                type="source"
                position={Position.Right}
                id={component.id}
                className="bmf-component-handle"
              />
              <span
                className="bmf-hidden-ref-inline"
                style={{ backgroundColor: getLightColor(targetTypeColor, 0.7) }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isHidden) {
                    onHiddenReferenceClick?.(component.reference!);
                  } else {
                    onReferenceClick?.(component.reference!);
                  }
                }}
                title={isHidden
                  ? `${component.reference} is hidden by filters. Click to view.`
                  : `Navigate to ${component.reference}`
                }
              >
                {isHidden && <EyeOffIcon />}
                {component.reference}
              </span>
            </>
          )}
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
  const shortId = idParts.length > 2 ? `${idParts.slice(2).join(':')}` : idParts[idParts.length - 1];

  // Check if node is an orphan (not referenced by anyone)
  const isOrphan = !data.isReferenced;

  const incomingHidden = data.incomingHiddenRefs || [];

  return (
    <div className="bmf-node-wrapper">
      {/* Hidden incoming references - left side badges */}
      {incomingHidden.length > 0 && (
        <div className="bmf-hidden-refs bmf-hidden-refs-left">
          {incomingHidden.map((ref) => (
            <span
              key={ref.nodeId}
              className="bmf-hidden-ref-badge"
              style={{ backgroundColor: getTypeColor(ref.nodeType) }}
              onClick={(e) => {
                e.stopPropagation();
                data.onHiddenReferenceClick?.(ref.nodeId);
              }}
              title={`${ref.nodeId} is hidden by filters. Click to view.`}
            >
              <EyeOffIcon />
              {ref.nodeId}
            </span>
          ))}
        </div>
      )}

      {/* The actual node */}
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
                onHiddenReferenceClick={data.onHiddenReferenceClick}
                refInfo={data.referenceInfo?.get(comp.id)}
              />
            ))}
          </div>
        )}

        {/* Default source handle if no components with references */}
        {data.components.every(c => !c.reference) && (
          <Handle type="source" position={Position.Right} id="source" />
        )}
      </div>
    </div>
  );
}

export const BmfNode = memo(BmfNodeComponent);
