import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useBmfStore } from './store/bmfStore';
import { NO_TAGS_FILTER } from './components/FilterOverlay';
import { NavigationGraph } from './components/NavigationGraph';

// File System Access API types (not yet in lib.dom.d.ts)
interface FSFileSystemDirectoryHandle {
  name: string;
  kind: 'directory';
  values(): AsyncIterable<FSFileSystemHandle>;
}

interface FSFileSystemFileHandle {
  name: string;
  kind: 'file';
  getFile(): Promise<File>;
}

type FSFileSystemHandle = FSFileSystemDirectoryHandle | FSFileSystemFileHandle;

// Expose store on window for testing
declare global {
  interface Window {
    __BMF_STORE__: typeof useBmfStore;
    __BMF_TEST_DATA__?: { content: string; fileName: string };
    showDirectoryPicker?: () => Promise<FSFileSystemDirectoryHandle>;
  }
}

// This runs immediately when module loads
if (typeof window !== 'undefined') {
  window.__BMF_STORE__ = useBmfStore;
}

// Recursively read all YAML files from a directory
async function readYamlFiles(
  dirHandle: FSFileSystemDirectoryHandle,
  basePath: string = ''
): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  for await (const entry of dirHandle.values()) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.kind === 'file') {
      if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
        const fileHandle = entry as FSFileSystemFileHandle;
        const file = await fileHandle.getFile();
        const content = await file.text();
        files.set(entryPath, content);
      }
    } else if (entry.kind === 'directory') {
      // Recursively read subdirectories
      const subHandle = entry as FSFileSystemDirectoryHandle;
      const subFiles = await readYamlFiles(subHandle, entryPath);
      subFiles.forEach((content, path) => files.set(path, content));
    }
  }

  return files;
}

function WelcomeView() {
  const loadFromYaml = useBmfStore((s) => s.loadFromYaml);
  const loadFromFiles = useBmfStore((s) => s.loadFromFiles);
  const loading = useBmfStore((s) => s.loading);
  const error = useBmfStore((s) => s.error);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportsFileSystem = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const handleOpenFolder = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      alert('Your browser does not support the File System Access API. Please use Chrome, Edge, or Opera.');
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker();
      const folderName = dirHandle.name;

      const files = await readYamlFiles(dirHandle);

      if (files.size === 0) {
        alert('No YAML files found in the selected folder.');
        return;
      }

      // Pass the directory handle to enable saving comments
      loadFromFiles(files, folderName, dirHandle as unknown as Parameters<typeof loadFromFiles>[2]);
    } catch (e) {
      // User cancelled or error
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error('Failed to open folder:', e);
      }
    }
  }, [loadFromFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.yaml') || file.name.endsWith('.yml'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        loadFromYaml(content, file.name);
      };
      reader.readAsText(file);
    }
  }, [loadFromYaml]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        loadFromYaml(content, file.name);
      };
      reader.readAsText(file);
    }
  }, [loadFromYaml]);

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="welcome-view">
      <h1>BMF Viewer</h1>
      <p className="welcome-subtitle">Interactive viewer for BMF specifications</p>

      {supportsFileSystem && (
        <button className="open-folder-btn" onClick={handleOpenFolder}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Open Spec Folder
        </button>
      )}

      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleDropZoneClick}
      >
        <div className="drop-zone-content">
          <p>Drop a YAML file here</p>
          <p className="drop-zone-hint">or click to select</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="expected-structure">
        <h2>Expected Structure</h2>
        <pre>{`spec/
├── actors.yaml
├── context.yaml
├── toasts.yaml
├── config/
├── entities/
├── layouts/
├── screens/
├── dialogs/
├── components/
└── actions/`}</pre>
      </div>

      {loading && (
        <div className="loading-overlay">
          <span>Loading...</span>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

function AppContent() {
  const loaded = useBmfStore((s) => s.loaded);
  const graph = useBmfStore((s) => s.graph);
  const fileName = useBmfStore((s) => s.fileName);
  const directoryHandle = useBmfStore((s) => s.directoryHandle);
  const reset = useBmfStore((s) => s.reset);
  const refreshFolder = useBmfStore((s) => s.refreshFolder);
  const loadFromYaml = useBmfStore((s) => s.loadFromYaml);
  const hiddenTypes = useBmfStore((s) => s.hiddenTypes);
  const hiddenEpics = useBmfStore((s) => s.hiddenEpics);
  const hiddenTags = useBmfStore((s) => s.hiddenTags);

  // Auto-load test data if available (for E2E tests)
  useEffect(() => {
    const testData = window.__BMF_TEST_DATA__;
    if (testData && !loaded) {
      loadFromYaml(testData.content, testData.fileName);
    }
  }, [loaded, loadFromYaml]);

  // Calculate visible counts based on filters
  const { visibleNodes, visibleEdges } = useMemo(() => {
    if (!graph) return { visibleNodes: 0, visibleEdges: 0 };

    const visibleNodeIds = new Set<string>();
    graph.nodes.forEach((node) => {
      const isTypeHidden = hiddenTypes.has(node.type);
      const isEpicHidden = node.epic && hiddenEpics.has(node.epic);
      const isTagHidden = node.tags.length > 0 && node.tags.every(tag => hiddenTags.has(tag));
      const isNoTagsHidden = node.tags.length === 0 && hiddenTags.has(NO_TAGS_FILTER);
      if (!isTypeHidden && !isEpicHidden && !isTagHidden && !isNoTagsHidden) {
        visibleNodeIds.add(node.id);
      }
    });

    const visibleEdgeCount = graph.edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    ).length;

    return { visibleNodes: visibleNodeIds.size, visibleEdges: visibleEdgeCount };
  }, [graph, hiddenTypes, hiddenEpics, hiddenTags]);

  if (!loaded || !graph) {
    return <WelcomeView />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>BMF Viewer</h1>
        <span className="file-name">{fileName}</span>
        <span className="stats">
          {graph.nodes.length} nodes ({visibleNodes}) / {graph.edges.length} edges ({visibleEdges})
        </span>
        {directoryHandle && (
          <button onClick={refreshFolder} className="refresh-btn" title="Refresh folder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        )}
        <button onClick={reset} className="reset-btn">
          Load another file
        </button>
      </header>
      <main className="app-main">
        <NavigationGraph graph={graph} />
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
