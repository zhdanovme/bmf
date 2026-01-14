#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function findYamlFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
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

function removeTcTagsWithRegex(content: string): string {
  // Remove tc:* tags from YAML tag arrays using regex
  // Matches patterns like: tc:epic:name, tc:epic:name:start, tc:epic:name:end
  return content.replace(/,?\s*tc:[a-z0-9-]+:[a-z0-9-]+(?::[a-z0-9-]+)?/g, '')
    .replace(/\[\s*,/g, '[') // Clean up leading commas
    .replace(/,\s*\]/g, ']') // Clean up trailing commas
    .replace(/,\s*,/g, ','); // Clean up double commas
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx ts-node utils/delete-tc-tags.ts <folder>');
    process.exit(1);
  }

  console.log('🗑️  Removing tc:* tags...\n');

  let modified = 0;
  let skipped = 0;

  for (const folder of args) {
    if (!fs.existsSync(folder)) {
      console.error(`❌ Folder not found: ${folder}`);
      continue;
    }

    for (const file of findYamlFiles(folder)) {
      const before = fs.readFileSync(file, 'utf-8');

      // Try yq first, fall back to regex if yq fails (e.g., for files with non-standard YAML)
      let after: string;
      try {
        execSync(`yq -i '(.*.tags) |= (. // [] | map(select(test("^tc:") | not)))' "${file}"`, { stdio: 'pipe' });
        after = fs.readFileSync(file, 'utf-8');
      } catch {
        // yq failed - use regex fallback
        after = removeTcTagsWithRegex(before);
        if (after !== before) {
          fs.writeFileSync(file, after);
        }
        skipped++;
      }

      if (before !== after) {
        console.log(`   ✅ ${path.relative(process.cwd(), file)}`);
        modified++;
      }
    }
  }

  const msg = modified > 0 ? `✅ Modified ${modified} file(s)` : 'ℹ️  No tc:* tags found';
  const skipMsg = skipped > 0 ? ` (${skipped} file(s) used regex fallback)` : '';
  console.log(`\n${msg}${skipMsg}`);
}

main();
