// Zustand store for BMF viewer state
import { create } from 'zustand';
import type { ParsedBmf, BmfGraph, BmfEntity } from '../types/bmf';
import { parseBmfYaml, parseBmfFiles } from '../utils/parser';
import { buildGraph, getConnectedNodes } from '../utils/graphBuilder';
import YAML from 'yaml';

// Storage keys
const FILTERS_KEY = 'bmf-viewer-filters';
const COMMENTS_FILENAME = '_comments.yaml';

// File System Access API types
interface FileSystemDirectoryHandle {
  name: string;
  kind: 'directory';
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

interface FileSystemFileHandle {
  name: string;
  kind: 'file';
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}

// Generate project ID from path
function generateProjectId(path: string): string {
  // Simple hash of the path
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Filter storage types
interface StoredFilters {
  hiddenTypes: string[];
  hiddenEpics: string[];
}

// Get filters from localStorage
function getFiltersFromStorage(): { hiddenTypes: Set<string>; hiddenEpics: Set<string> } {
  try {
    const stored = localStorage.getItem(FILTERS_KEY);
    if (stored) {
      const parsed: StoredFilters = JSON.parse(stored);
      return {
        hiddenTypes: new Set(parsed.hiddenTypes || []),
        hiddenEpics: new Set(parsed.hiddenEpics || []),
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { hiddenTypes: new Set(), hiddenEpics: new Set() };
}

// Save filters to localStorage
function saveFiltersToStorage(hiddenTypes: Set<string>, hiddenEpics: Set<string>): void {
  try {
    const data: StoredFilters = {
      hiddenTypes: Array.from(hiddenTypes),
      hiddenEpics: Array.from(hiddenEpics),
    };
    localStorage.setItem(FILTERS_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export interface QuestionAnswer {
  question: string;
  answer?: string;
}

export interface Comment {
  entityId: string;
  text: string;
  createdAt: number;
  resolved: boolean;
  resolution?: string;
  questions?: QuestionAnswer[];
}

interface BmfState {
  // Data
  loaded: boolean;
  loading: boolean;
  error: string | null;
  fileName: string | null;
  projectId: string | null;
  projectPath: string | null;
  parsed: ParsedBmf | null;
  graph: BmfGraph | null;
  directoryHandle: FileSystemDirectoryHandle | null;

  // UI State
  selectedNodeId: string | null;
  connectedNodes: Set<string>;
  commentDialogOpen: boolean;

  // Filter state
  hiddenTypes: Set<string>;
  hiddenEpics: Set<string>;
  availableTypes: string[];
  availableEpics: string[];

  // Comments
  comments: Map<string, Comment>;

  // Actions
  loadFromYaml: (content: string, fileName: string) => void;
  loadFromFiles: (files: Map<string, string>, folderName: string, folderPath: string, dirHandle?: FileSystemDirectoryHandle) => void;
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
  reset: () => void;
  selectNode: (nodeId: string | null) => void;
  toggleType: (type: string) => void;
  toggleEpic: (epic: string) => void;
  openCommentDialog: () => void;
  closeCommentDialog: () => void;
  addComment: (entityId: string, text: string) => void;
  removeComment: (entityId: string) => void;
  toggleResolve: (entityId: string, resolved: boolean) => void;
  addQuestion: (entityId: string, question: string) => void;
  updateQuestionAnswer: (entityId: string, questionIndex: number, answer: string) => void;
  setResolution: (entityId: string, resolution: string) => void;
  exportCommentsYaml: () => string;
  importCommentsYaml: (yaml: string) => void;
  saveCommentsToFile: () => Promise<void>;

  // Getters
  getEntity: (id: string) => BmfEntity | undefined;
  getComment: (entityId: string) => Comment | undefined;
}

// Extract unique types and epics from graph nodes
function extractFilters(graph: BmfGraph): { types: string[]; epics: string[] } {
  const types = new Set<string>();
  const epics = new Set<string>();

  graph.nodes.forEach((node) => {
    types.add(node.type);
    if (node.epic) {
      epics.add(node.epic);
    }
  });

  return {
    types: Array.from(types).sort(),
    epics: Array.from(epics).sort(),
  };
}

export const useBmfStore = create<BmfState>((set, get) => ({
  loaded: false,
  loading: false,
  error: null,
  fileName: null,
  projectId: null,
  projectPath: null,
  parsed: null,
  graph: null,
  directoryHandle: null,
  selectedNodeId: null,
  connectedNodes: new Set(),
  commentDialogOpen: false,
  hiddenTypes: getFiltersFromStorage().hiddenTypes,
  hiddenEpics: getFiltersFromStorage().hiddenEpics,
  availableTypes: [],
  availableEpics: [],
  comments: new Map(),

  loadFromYaml: (content: string, fileName: string) => {
    set({ loading: true, error: null });

    try {
      const parsed = parseBmfYaml(content);
      const graph = buildGraph(parsed);
      const projectId = generateProjectId(fileName);
      const { types, epics } = extractFilters(graph);
      const storedFilters = getFiltersFromStorage();

      // Update URL
      window.history.replaceState({}, '', `?project=${projectId}`);

      set({
        loaded: true,
        loading: false,
        fileName,
        projectId,
        projectPath: fileName,
        parsed,
        graph,
        selectedNodeId: null,
        connectedNodes: new Set(),
        hiddenTypes: storedFilters.hiddenTypes,
        hiddenEpics: storedFilters.hiddenEpics,
        availableTypes: types,
        availableEpics: epics,
      });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to parse YAML',
      });
    }
  },

  loadFromFiles: (files: Map<string, string>, folderName: string, folderPath: string, dirHandle?: FileSystemDirectoryHandle) => {
    set({ loading: true, error: null });

    try {
      const parsed = parseBmfFiles(files);
      const graph = buildGraph(parsed);
      const projectId = generateProjectId(folderPath);
      const { types, epics } = extractFilters(graph);
      const storedFilters = getFiltersFromStorage();

      // Load comments from _comments.yaml if present
      let comments = new Map<string, Comment>();
      const commentsContent = files.get(COMMENTS_FILENAME);
      if (commentsContent) {
        try {
          const parsed = YAML.parse(commentsContent) as Record<string, Comment>;
          if (parsed && typeof parsed === 'object') {
            Object.entries(parsed).forEach(([entityId, data]) => {
              if (entityId.startsWith('#')) return;
              comments.set(entityId, {
                entityId,
                text: data.text || '',
                createdAt: data.createdAt || Date.now(),
                resolved: data.resolved || false,
                resolution: data.resolution,
                questions: data.questions,
              });
            });
          }
        } catch {
          console.warn('Failed to parse _comments.yaml');
        }
      }

      // Update URL
      window.history.replaceState({}, '', `?project=${projectId}`);

      set({
        loaded: true,
        loading: false,
        fileName: folderName,
        projectId,
        projectPath: folderPath,
        parsed,
        graph,
        directoryHandle: dirHandle || null,
        selectedNodeId: null,
        connectedNodes: new Set(),
        hiddenTypes: storedFilters.hiddenTypes,
        hiddenEpics: storedFilters.hiddenEpics,
        availableTypes: types,
        availableEpics: epics,
        comments,
      });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to parse files',
      });
    }
  },

  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => {
    set({ directoryHandle: handle });
  },

  reset: () => {
    // Clear URL
    window.history.replaceState({}, '', window.location.pathname);

    // Clear stored filters
    saveFiltersToStorage(new Set(), new Set());

    set({
      loaded: false,
      loading: false,
      error: null,
      fileName: null,
      projectId: null,
      projectPath: null,
      parsed: null,
      graph: null,
      directoryHandle: null,
      selectedNodeId: null,
      connectedNodes: new Set(),
      hiddenTypes: new Set(),
      hiddenEpics: new Set(),
      availableTypes: [],
      availableEpics: [],
      comments: new Map(),
    });
  },

  selectNode: (nodeId: string | null) => {
    const { graph } = get();

    if (!nodeId || !graph) {
      set({
        selectedNodeId: null,
        connectedNodes: new Set(),
      });
      return;
    }

    const connected = getConnectedNodes(nodeId, graph.edges);

    set({
      selectedNodeId: nodeId,
      connectedNodes: connected,
    });
  },

  toggleType: (type: string) => {
    const { hiddenTypes, hiddenEpics } = get();
    const newHidden = new Set(hiddenTypes);
    if (newHidden.has(type)) {
      newHidden.delete(type);
    } else {
      newHidden.add(type);
    }
    saveFiltersToStorage(newHidden, hiddenEpics);
    set({ hiddenTypes: newHidden });
  },

  toggleEpic: (epic: string) => {
    const { hiddenTypes, hiddenEpics } = get();
    const newHidden = new Set(hiddenEpics);
    if (newHidden.has(epic)) {
      newHidden.delete(epic);
    } else {
      newHidden.add(epic);
    }
    saveFiltersToStorage(hiddenTypes, newHidden);
    set({ hiddenEpics: newHidden });
  },

  openCommentDialog: () => {
    set({ commentDialogOpen: true });
  },

  closeCommentDialog: () => {
    set({ commentDialogOpen: false });
  },

  addComment: (entityId: string, text: string) => {
    const { comments, saveCommentsToFile } = get();
    const newComments = new Map(comments);
    newComments.set(entityId, {
      entityId,
      text,
      createdAt: Date.now(),
      resolved: false,
    });
    set({ comments: newComments, commentDialogOpen: false });
    saveCommentsToFile();
  },

  removeComment: (entityId: string) => {
    const { comments, saveCommentsToFile } = get();
    const newComments = new Map(comments);
    newComments.delete(entityId);
    set({ comments: newComments });
    saveCommentsToFile();
  },

  toggleResolve: (entityId: string, resolved: boolean) => {
    const { comments, saveCommentsToFile } = get();
    const comment = comments.get(entityId);
    if (!comment) return;
    const newComments = new Map(comments);
    newComments.set(entityId, { ...comment, resolved });
    set({ comments: newComments });
    saveCommentsToFile();
  },

  addQuestion: (entityId: string, question: string) => {
    const { comments, saveCommentsToFile } = get();
    const comment = comments.get(entityId);
    if (!comment) return;
    const newComments = new Map(comments);
    const newQuestions = comment.questions || [];
    newComments.set(entityId, { ...comment, questions: [...newQuestions, { question }] });
    set({ comments: newComments });
    saveCommentsToFile();
  },

  updateQuestionAnswer: (entityId: string, questionIndex: number, answer: string) => {
    const { comments, saveCommentsToFile } = get();
    const comment = comments.get(entityId);
    if (!comment || !comment.questions) return;
    const newComments = new Map(comments);
    const newQuestions = [...comment.questions];
    newQuestions[questionIndex] = { ...newQuestions[questionIndex], answer };
    newComments.set(entityId, { ...comment, questions: newQuestions });
    set({ comments: newComments });
    saveCommentsToFile();
  },

  setResolution: (entityId: string, resolution: string) => {
    const { comments, saveCommentsToFile } = get();
    const comment = comments.get(entityId);
    if (!comment) return;
    const newComments = new Map(comments);
    newComments.set(entityId, { ...comment, resolution, resolved: true });
    set({ comments: newComments });
    saveCommentsToFile();
  },

  importCommentsYaml: (yaml: string) => {
    const { saveCommentsToFile } = get();
    try {
      const parsed = YAML.parse(yaml) as Record<string, Comment>;
      if (!parsed || typeof parsed !== 'object') return;

      const newComments = new Map<string, Comment>();
      Object.entries(parsed).forEach(([entityId, data]) => {
        if (entityId.startsWith('#')) return;
        newComments.set(entityId, {
          entityId,
          text: data.text || '',
          createdAt: data.createdAt || Date.now(),
          resolved: data.resolved || false,
          resolution: data.resolution,
          questions: data.questions,
        });
      });
      set({ comments: newComments });
      saveCommentsToFile();
    } catch (e) {
      console.error('Failed to import comments:', e);
    }
  },

  exportCommentsYaml: () => {
    const { comments } = get();
    if (comments.size === 0) return '';

    // Helper to format multiline text with proper indentation
    const formatMultiline = (text: string, indent: string): string => {
      const lines = text.split('\n');
      return lines.map(line => `${indent}${line}`).join('\n');
    };

    const yamlLines = ['# BMF Comments', '# Generated by BMF Viewer', ''];

    comments.forEach((comment, entityId) => {
      yamlLines.push(`${entityId}:`);
      yamlLines.push(`  text: |`);
      yamlLines.push(formatMultiline(comment.text, '    '));
      yamlLines.push(`  createdAt: ${comment.createdAt}`);
      yamlLines.push(`  resolved: ${comment.resolved}`);
      if (comment.resolution) {
        yamlLines.push(`  resolution: |`);
        yamlLines.push(formatMultiline(comment.resolution, '    '));
      }
      if (comment.questions && comment.questions.length > 0) {
        yamlLines.push(`  questions:`);
        comment.questions.forEach((qa) => {
          yamlLines.push(`    - question: |`);
          yamlLines.push(formatMultiline(qa.question, '        '));
          if (qa.answer) {
            yamlLines.push(`      answer: |`);
            yamlLines.push(formatMultiline(qa.answer, '        '));
          }
        });
      }
      yamlLines.push('');
    });

    return yamlLines.join('\n');
  },

  saveCommentsToFile: async () => {
    const { directoryHandle, exportCommentsYaml } = get();
    if (!directoryHandle) {
      console.warn('No directory handle available for saving comments');
      return;
    }

    try {
      const yamlContent = exportCommentsYaml();
      // Always write the file, even if empty (creates file with headers only)
      const content = yamlContent || '# BMF Comments\n# Generated by BMF Viewer\n';

      const fileHandle = await directoryHandle.getFileHandle(COMMENTS_FILENAME, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (e) {
      console.error('Failed to save comments to file:', e);
    }
  },

  getEntity: (id: string) => {
    const { parsed } = get();
    return parsed?.entities.get(id);
  },

  getComment: (entityId: string) => {
    const { comments } = get();
    return comments.get(entityId);
  },
}));

// Expose store for testing
declare global {
  interface Window {
    __BMF_STORE__: typeof useBmfStore;
    __BMF_TEST_DATA__?: { content: string; fileName: string };
  }
}

if (typeof window !== 'undefined') {
  window.__BMF_STORE__ = useBmfStore;
}
