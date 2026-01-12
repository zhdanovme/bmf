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
  hiddenTags: string[];
}

// Get filters from localStorage
function getFiltersFromStorage(): { hiddenTypes: Set<string>; hiddenEpics: Set<string>; hiddenTags: Set<string> } {
  try {
    const stored = localStorage.getItem(FILTERS_KEY);
    if (stored) {
      const parsed: StoredFilters = JSON.parse(stored);
      return {
        hiddenTypes: new Set(parsed.hiddenTypes || []),
        hiddenEpics: new Set(parsed.hiddenEpics || []),
        hiddenTags: new Set(parsed.hiddenTags || []),
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { hiddenTypes: new Set(), hiddenEpics: new Set(), hiddenTags: new Set() };
}

// Save filters to localStorage
function saveFiltersToStorage(hiddenTypes: Set<string>, hiddenEpics: Set<string>, hiddenTags: Set<string>): void {
  try {
    const data: StoredFilters = {
      hiddenTypes: Array.from(hiddenTypes),
      hiddenEpics: Array.from(hiddenEpics),
      hiddenTags: Array.from(hiddenTags),
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

// Hovered filter for node highlighting
export interface HoveredFilter {
  category: 'type' | 'epic' | 'tag';
  value: string;
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
  hoveredFilter: HoveredFilter | null;
  searchOpen: boolean;
  searchQuery: string;

  // Filter state
  hiddenTypes: Set<string>;
  hiddenEpics: Set<string>;
  hiddenTags: Set<string>;
  availableTypes: string[];
  availableEpics: string[];
  availableTags: string[];

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
  toggleTag: (tag: string) => void;
  setHoveredFilter: (filter: HoveredFilter | null) => void;
  openCommentDialog: () => void;
  closeCommentDialog: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  addComment: (entityId: string, text: string) => void;
  removeComment: (entityId: string) => void;
  toggleResolve: (entityId: string, resolved: boolean) => void;
  addQuestion: (entityId: string, question: string) => void;
  updateQuestionAnswer: (entityId: string, questionIndex: number, answer: string) => void;
  setResolution: (entityId: string, resolution: string) => void;
  saveCommentsToFile: () => Promise<void>;
  _exportCommentsYaml: () => string;

  // Getters
  getEntity: (id: string) => BmfEntity | undefined;
  getComment: (entityId: string) => Comment | undefined;
}

// Extract unique types, epics and tags from graph nodes
function extractFilters(graph: BmfGraph): { types: string[]; epics: string[]; tags: string[] } {
  const types = new Set<string>();
  const epics = new Set<string>();
  const tags = new Set<string>();

  graph.nodes.forEach((node) => {
    types.add(node.type);
    if (node.epic) {
      epics.add(node.epic);
    }
    node.tags.forEach(tag => tags.add(tag));
  });

  return {
    types: Array.from(types).sort(),
    epics: Array.from(epics).sort(),
    tags: Array.from(tags).sort(),
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
  hoveredFilter: null,
  searchOpen: false,
  searchQuery: '',
  hiddenTypes: getFiltersFromStorage().hiddenTypes,
  hiddenEpics: getFiltersFromStorage().hiddenEpics,
  hiddenTags: getFiltersFromStorage().hiddenTags,
  availableTypes: [],
  availableEpics: [],
  availableTags: [],
  comments: new Map(),

  loadFromYaml: (content: string, fileName: string) => {
    set({ loading: true, error: null });

    try {
      const parsed = parseBmfYaml(content);
      const graph = buildGraph(parsed);
      const projectId = generateProjectId(fileName);
      const { types, epics, tags } = extractFilters(graph);
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
        hiddenTags: storedFilters.hiddenTags,
        availableTypes: types,
        availableEpics: epics,
        availableTags: tags,
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
      const { types, epics, tags } = extractFilters(graph);
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
        hiddenTags: storedFilters.hiddenTags,
        availableTypes: types,
        availableEpics: epics,
        availableTags: tags,
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
    saveFiltersToStorage(new Set(), new Set(), new Set());

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
      hiddenTags: new Set(),
      availableTypes: [],
      availableEpics: [],
      availableTags: [],
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
    const { hiddenTypes, hiddenEpics, hiddenTags } = get();
    const newHidden = new Set(hiddenTypes);
    if (newHidden.has(type)) {
      newHidden.delete(type);
    } else {
      newHidden.add(type);
    }
    saveFiltersToStorage(newHidden, hiddenEpics, hiddenTags);
    set({ hiddenTypes: newHidden });
  },

  toggleEpic: (epic: string) => {
    const { hiddenTypes, hiddenEpics, hiddenTags } = get();
    const newHidden = new Set(hiddenEpics);
    if (newHidden.has(epic)) {
      newHidden.delete(epic);
    } else {
      newHidden.add(epic);
    }
    saveFiltersToStorage(hiddenTypes, newHidden, hiddenTags);
    set({ hiddenEpics: newHidden });
  },

  toggleTag: (tag: string) => {
    const { hiddenTypes, hiddenEpics, hiddenTags } = get();
    const newHidden = new Set(hiddenTags);
    if (newHidden.has(tag)) {
      newHidden.delete(tag);
    } else {
      newHidden.add(tag);
    }
    saveFiltersToStorage(hiddenTypes, hiddenEpics, newHidden);
    set({ hiddenTags: newHidden });
  },

  setHoveredFilter: (filter: HoveredFilter | null) => {
    set({ hoveredFilter: filter });
  },

  openCommentDialog: () => {
    set({ commentDialogOpen: true });
  },

  closeCommentDialog: () => {
    set({ commentDialogOpen: false });
  },

  openSearch: () => {
    set({ searchOpen: true, searchQuery: '' });
  },

  closeSearch: () => {
    set({ searchOpen: false, searchQuery: '' });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
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

  _exportCommentsYaml: () => {
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
    const { directoryHandle, _exportCommentsYaml } = get();
    if (!directoryHandle) {
      console.warn('No directory handle available for saving comments');
      return;
    }

    try {
      const yamlContent = _exportCommentsYaml();
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
