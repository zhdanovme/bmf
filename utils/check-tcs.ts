#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

// Entity types that MUST be covered by tc:* tags (user-facing flow entities)
const REQUIRED_COVERAGE_TYPES = new Set([
  'screen',
  'dialog',
  'action',
  'event'
]);

// Entity types that are optional for coverage (structural/data entities)
const OPTIONAL_COVERAGE_TYPES = new Set([
  'entity',
  'component',
  'layout',
  'context',
  'config',
  'toast',
  'components' // YAML anchor groups
]);

interface EntityInfo {
  id: string;
  type: string;
  file: string;
  hasTcTag: boolean;
  tcTags: string[];
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

function getEntityType(id: string): string {
  return id.split(':')[0];
}

function extractTcTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag): tag is string =>
    typeof tag === 'string' && tag.startsWith('tc:')
  );
}

function normalizeTcTag(tag: string): string {
  return tag.replace(/:start$/, '').replace(/:end$/, '');
}

function processYamlFile(filePath: string): EntityInfo[] {
  const entities: EntityInfo[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(content);

    if (!parsed || typeof parsed !== 'object') return entities;

    Object.entries(parsed).forEach(([key, value]) => {
      if (!key.includes(':')) return;

      const type = getEntityType(key);
      const entityValue = value as Record<string, unknown> | null;
      const tags = entityValue?.tags;
      const tcTags = extractTcTags(tags);

      entities.push({
        id: key,
        type,
        file: filePath,
        hasTcTag: tcTags.length > 0,
        tcTags
      });
    });
  } catch (e) {
    console.error(`Error parsing ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
  }

  return entities;
}

function loadTestCases(folder: string): Set<string> {
  const tcIds = new Set<string>();
  const testCasesPath = path.join(folder, '_test-cases.yaml');

  if (!fs.existsSync(testCasesPath)) return tcIds;

  try {
    const content = fs.readFileSync(testCasesPath, 'utf-8');
    const parsed = YAML.parse(content);

    if (!parsed || typeof parsed !== 'object') return tcIds;

    Object.keys(parsed).forEach(key => {
      if (key.startsWith('tc:')) {
        tcIds.add(key);
      }
    });
  } catch (e) {
    console.error(`Error parsing _test-cases.yaml: ${e instanceof Error ? e.message : String(e)}`);
  }

  return tcIds;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx ts-node utils/check-tcs.ts <folder>');
    console.error('Example: npx ts-node utils/check-tcs.ts bmfs/examples/marketplace');
    process.exit(1);
  }

  const folder = args[0];
  if (!fs.existsSync(folder)) {
    console.error(`Folder not found: ${folder}`);
    process.exit(1);
  }

  console.log('Checking tc:* coverage...\n');

  const files = findYamlFiles(folder);
  const allEntities: EntityInfo[] = [];

  for (const file of files) {
    allEntities.push(...processYamlFile(file));
  }

  // Categorize entities
  const coveredRequired: EntityInfo[] = [];
  const uncoveredRequired: EntityInfo[] = [];
  const coveredOptional: EntityInfo[] = [];
  const uncoveredOptional: EntityInfo[] = [];

  for (const entity of allEntities) {
    const isRequired = REQUIRED_COVERAGE_TYPES.has(entity.type);
    const isOptional = OPTIONAL_COVERAGE_TYPES.has(entity.type);

    if (isRequired) {
      if (entity.hasTcTag) {
        coveredRequired.push(entity);
      } else {
        uncoveredRequired.push(entity);
      }
    } else if (isOptional) {
      if (entity.hasTcTag) {
        coveredOptional.push(entity);
      } else {
        uncoveredOptional.push(entity);
      }
    }
  }

  // Load TC definitions and find orphan tags
  const tcIds = loadTestCases(folder);
  const allTcTags = new Set<string>();
  for (const entity of allEntities) {
    for (const tag of entity.tcTags) {
      allTcTags.add(normalizeTcTag(tag));
    }
  }
  const orphanTcTags = Array.from(allTcTags).filter(tag => !tcIds.has(tag));

  // Summary
  const totalRequired = coveredRequired.length + uncoveredRequired.length;
  const totalOptional = coveredOptional.length + uncoveredOptional.length;

  console.log('Summary:');
  console.log(`   Test Cases defined: ${tcIds.size}`);
  console.log(`   Required entities: ${totalRequired} (${coveredRequired.length} covered)`);
  console.log(`   Optional entities: ${totalOptional} (${coveredOptional.length} covered)`);
  console.log('');

  // Coverage by type for required entities
  if (coveredRequired.length > 0) {
    console.log('Covered (required):');
    const byType = new Map<string, number>();
    for (const e of coveredRequired) {
      byType.set(e.type, (byType.get(e.type) || 0) + 1);
    }
    for (const [type, count] of byType) {
      const total = coveredRequired.filter(e => e.type === type).length +
                   uncoveredRequired.filter(e => e.type === type).length;
      console.log(`   ${type}: ${count}/${total}`);
    }
    console.log('');
  }

  // Uncovered required entities (ERRORS)
  if (uncoveredRequired.length > 0) {
    console.log(`UNCOVERED - MUST FIX (${uncoveredRequired.length}):\n`);

    const byType = new Map<string, EntityInfo[]>();
    for (const entity of uncoveredRequired) {
      const list = byType.get(entity.type) || [];
      list.push(entity);
      byType.set(entity.type, list);
    }

    for (const [type, entities] of byType) {
      console.log(`   ${type}:`);
      for (const entity of entities.sort((a, b) => a.id.localeCompare(b.id))) {
        const relativePath = path.relative(process.cwd(), entity.file);
        console.log(`      - ${entity.id}`);
        console.log(`        ${relativePath}`);
      }
    }
    console.log('');
  }

  // Uncovered optional entities (INFO only)
  if (uncoveredOptional.length > 0) {
    console.log(`Uncovered (optional - ${uncoveredOptional.length}):`);
    const byType = new Map<string, number>();
    for (const e of uncoveredOptional) {
      byType.set(e.type, (byType.get(e.type) || 0) + 1);
    }
    for (const [type, count] of byType) {
      console.log(`   ${type}: ${count}`);
    }
    console.log('');
  }

  // Orphan tc:* tags
  if (orphanTcTags.length > 0) {
    console.log(`Orphan tc:* tags (${orphanTcTags.length} tags reference undefined TCs):\n`);
    for (const tag of orphanTcTags.sort()) {
      console.log(`   - ${tag}`);
    }
    console.log('');
  }

  // Final status
  if (uncoveredRequired.length > 0) {
    console.log(`${uncoveredRequired.length} required entities need tc:* coverage`);
    console.log('\nTo add coverage:');
    console.log('  yq -i \'.["entity:id"].tags += ["tc:epic:scenario"]\' file.yaml');
    process.exit(1);
  } else if (orphanTcTags.length > 0) {
    console.log('All required entities covered');
    console.log(`${orphanTcTags.length} orphan tc:* tags found - add definitions to _test-cases.yaml`);
    process.exit(0);
  } else {
    console.log('All required entities have tc:* coverage');
    process.exit(0);
  }
}

main();
