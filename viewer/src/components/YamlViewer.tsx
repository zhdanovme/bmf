// YAML Viewer panel for showing entity details
import YAML from 'yaml';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useBmfStore } from '../store/bmfStore';

interface YamlViewerProps {
  nodeId: string;
  onClose: () => void;
}

export function YamlViewer({ nodeId, onClose }: YamlViewerProps) {
  const getEntity = useBmfStore((s) => s.getEntity);
  const openCommentDialog = useBmfStore((s) => s.openCommentDialog);
  const getComment = useBmfStore((s) => s.getComment);
  const entity = getEntity(nodeId);
  const comment = getComment(nodeId);

  if (!entity) {
    return (
      <div className="yaml-viewer">
        <div className="yaml-viewer-header">
          <span>{nodeId}</span>
          <button onClick={onClose} className="yaml-viewer-close">×</button>
        </div>
        <div className="yaml-viewer-content">
          <pre>Entity not found</pre>
        </div>
      </div>
    );
  }

  // Convert entity raw data to YAML
  const yamlContent = YAML.stringify({ [nodeId]: entity.raw }, { indent: 2 });

  return (
    <div className="yaml-viewer">
      <div className="yaml-viewer-header">
        <span className="yaml-viewer-title">{nodeId}</span>
        <div className="yaml-viewer-header-actions">
          <button
            onClick={openCommentDialog}
            className="yaml-viewer-comment-btn"
            title={`Add comment (Press C)`}
          >
            {comment ? 'Edit Comment' : 'Add Comment'}
          </button>
          <button onClick={onClose} className="yaml-viewer-close">×</button>
        </div>
      </div>
      <div className="yaml-viewer-content">
        <SyntaxHighlighter
          language="yaml"
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '16px',
            background: 'transparent',
            fontSize: '13px',
            lineHeight: '1.5',
          }}
        >
          {yamlContent}
        </SyntaxHighlighter>
      </div>
      <div className="yaml-viewer-footer">
        <span className="yaml-viewer-hint">Press <kbd>C</kbd> to add comment</span>
      </div>
    </div>
  );
}
