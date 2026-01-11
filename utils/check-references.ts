#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pattern to match $ references: $type.path or $type:path
const REFERENCE_PATTERN = /\$([a-z]+)[.:]([a-z0-9._:-]+)/gi;

// Pattern to match bare references: action:epic:name, event:epic:name, etc. (at start of string or after whitespace)
const BARE_REFERENCE_PATTERN = /(?:^|\s)(action|event|screen|dialog|component|layout|toast):([a-z0-9_-]+):([a-z0-9_-]+)/gi;

// Valid BMF entity types
const ENTITY_TYPES = new Set([
  'screen', 'dialog', 'event', 'action', 'component', 'layout', 'entity', 'context', 'config', 'toast', 'story'
]);

interface Reference {
  source: string;
  target: string;
  file: string;
  path: string;
}

interface CheckResult {
  definedIds: Set<string>;
  references: Reference[];
  orphanUsages: Reference[];       // References to non-existent IDs
  orphanDefinitions: string[];     // IDs that are never referenced
}

function findYamlFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name) && !entry.name.startsWith('_')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function parseEntityId(key: string): boolean {
  const parts = key.split(':');

  if (parts.length === 1) {
    return ENTITY_TYPES.has(parts[0]);
  }

  if (parts.length >= 2) {
    return ENTITY_TYPES.has(parts[0]);
  }

  return false;
}

function extractReferences(
  value: unknown,
  sourceId: string,
  filePath: string,
  currentPath: string,
  refs: Reference[]
): void {
  if (typeof value === 'string') {
    let match;

    // Match $ references: $type.path or $type:path
    REFERENCE_PATTERN.lastIndex = 0;
    while ((match = REFERENCE_PATTERN.exec(value)) !== null) {
      const targetType = match[1];
      const targetPath = match[2];
      // Convert $type.epic.name to type:epic:name
      const targetId = `${targetType}:${targetPath.replace(/\./g, ':')}`;
      refs.push({
        source: sourceId,
        target: targetId,
        file: filePath,
        path: currentPath
      });
    }

    // Match bare references: action:epic:name (without $ prefix)
    BARE_REFERENCE_PATTERN.lastIndex = 0;
    while ((match = BARE_REFERENCE_PATTERN.exec(value)) !== null) {
      const targetType = match[1];
      const epic = match[2];
      const name = match[3];
      const targetId = `${targetType}:${epic}:${name}`;
      refs.push({
        source: sourceId,
        target: targetId,
        file: filePath,
        path: currentPath
      });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      extractReferences(item, sourceId, filePath, `${currentPath}[${index}]`, refs);
    });
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, val]) => {
      extractReferences(val, sourceId, filePath, `${currentPath}.${key}`, refs);
    });
  }
}

function processYamlFile(
  filePath: string,
  definedIds: Set<string>,
  references: Reference[]
): void {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(content);

    if (!parsed || typeof parsed !== 'object') return;

    Object.entries(parsed).forEach(([key, value]) => {
      if (parseEntityId(key)) {
        definedIds.add(key);

        if (value && typeof value === 'object') {
          extractReferences(value, key, filePath, '', references);
        }
      }
    });
  } catch (e) {
    console.error(`Error parsing ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function checkReferences(folders: string[]): CheckResult {
  const definedIds = new Set<string>();
  const references: Reference[] = [];

  for (const folder of folders) {
    if (!fs.existsSync(folder)) {
      console.error(`Folder not found: ${folder}`);
      continue;
    }

    const yamlFiles = findYamlFiles(folder);

    for (const file of yamlFiles) {
      processYamlFile(file, definedIds, references);
    }
  }

  // Find orphan usages (references to non-existent IDs)
  const orphanUsages = references.filter(ref => {
    // Skip context references (they're often dynamic)
    if (ref.target.startsWith('context:')) return false;
    return !definedIds.has(ref.target);
  });

  // Find orphan definitions (IDs never referenced)
  const referencedIds = new Set(references.map(ref => ref.target));
  const orphanDefinitions = Array.from(definedIds).filter(id => {
    // Skip context (it's always referenced dynamically)
    if (id.startsWith('context:')) return false;
    // Skip stories (they're documentation, not referenced)
    if (id.startsWith('story:')) return false;
    return !referencedIds.has(id);
  });

  return { definedIds, references, orphanUsages, orphanDefinitions };
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run check-refs <folder1> <folder2> ...');
    console.error('Example: npm run check-refs specs/jumpster');
    process.exit(1);
  }

  console.log('🔍 Checking YAML references...\n');

  const result = checkReferences(args);

  console.log(`📊 Summary:`);
  console.log(`   Defined IDs: ${result.definedIds.size}`);
  console.log(`   Total references: ${result.references.length}`);
  console.log('');

  // Report orphan usages (references to non-existent IDs)
  if (result.orphanUsages.length > 0) {
    console.log(`❌ Orphan usages (${result.orphanUsages.length} references to non-existent IDs):\n`);

    // Group by target for cleaner output
    const byTarget = new Map<string, Reference[]>();
    for (const ref of result.orphanUsages) {
      const existing = byTarget.get(ref.target) || [];
      existing.push(ref);
      byTarget.set(ref.target, existing);
    }

    for (const [target, refs] of byTarget) {
      console.log(`   Missing: ${target}`);
      for (const ref of refs) {
        const relativePath = path.relative(process.cwd(), ref.file);
        console.log(`      ← referenced from ${ref.source} (${relativePath})`);
      }
    }
    console.log('');
  } else {
    console.log('✅ No orphan usages (all references point to existing IDs)\n');
  }

  // Report orphan definitions (IDs never used)
  if (result.orphanDefinitions.length > 0) {
    console.log(`⚠️  Orphan definitions (${result.orphanDefinitions.length} IDs never referenced):\n`);

    // Group by type for cleaner output
    const byType = new Map<string, string[]>();
    for (const id of result.orphanDefinitions) {
      const type = id.split(':')[0];
      const existing = byType.get(type) || [];
      existing.push(id);
      byType.set(type, existing);
    }

    for (const [type, ids] of byType) {
      console.log(`   ${type}:`);
      for (const id of ids.sort()) {
        console.log(`      - ${id}`);
      }
    }
    console.log('');
  } else {
    console.log('✅ No orphan definitions (all IDs are referenced)\n');
  }

  // Exit with error if there are orphan usages
  if (result.orphanUsages.length > 0) {
    console.log('❌ Check failed: found references to non-existent IDs');
    process.exit(1);
  } else {
    console.log('✅ All references are valid');
    process.exit(0);
  }
}

main();
