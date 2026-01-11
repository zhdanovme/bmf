#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

/**
 * Validates namespace consistency between _epics.yaml and _test-cases.yaml:
 *
 * 1. Epic IDs must be 2-segment: epic:domain (not epic:domain:subdomain)
 * 2. Every tc:DOMAIN:* must have a corresponding epic:DOMAIN
 * 3. Every epic:DOMAIN should have at least one tc:DOMAIN:*
 */

interface ValidationResult {
  epicIds: string[];
  tcIds: string[];
  invalidEpicIds: string[];       // 3+ segment epic IDs
  orphanTcDomains: string[];      // tc domains without matching epic
  emptyEpicDomains: string[];     // epic domains without any tc
  errors: number;
  warnings: number;
}

function loadYamlKeys(filePath: string, prefix: string): string[] {
  if (!fs.existsSync(filePath)) return [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(content);

    if (!parsed || typeof parsed !== 'object') return [];

    return Object.keys(parsed).filter(key => key.startsWith(prefix));
  } catch (e) {
    console.error(`Error parsing ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

function getDomain(id: string): string {
  // epic:auth → auth
  // tc:auth:login-success → auth
  const parts = id.split(':');
  return parts[1] || '';
}

function validate(folder: string): ValidationResult {
  const epicsPath = path.join(folder, '_epics.yaml');
  const testCasesPath = path.join(folder, '_test-cases.yaml');

  const epicIds = loadYamlKeys(epicsPath, 'epic:');
  const tcIds = loadYamlKeys(testCasesPath, 'tc:');

  const result: ValidationResult = {
    epicIds,
    tcIds,
    invalidEpicIds: [],
    orphanTcDomains: [],
    emptyEpicDomains: [],
    errors: 0,
    warnings: 0,
  };

  // 1. Check epic IDs are 2-segment only
  for (const id of epicIds) {
    const parts = id.split(':');
    if (parts.length !== 2) {
      result.invalidEpicIds.push(id);
      result.errors++;
    }
  }

  // 2. Collect domains
  const epicDomains = new Set(epicIds.map(getDomain));
  const tcDomains = new Set(tcIds.map(getDomain));

  // 3. Check every tc domain has a matching epic
  for (const domain of tcDomains) {
    if (!epicDomains.has(domain)) {
      result.orphanTcDomains.push(domain);
      result.errors++;
    }
  }

  // 4. Check every epic domain has at least one tc
  if (tcIds.length > 0) {
    for (const domain of epicDomains) {
      if (!tcDomains.has(domain)) {
        result.emptyEpicDomains.push(domain);
        result.warnings++;
      }
    }
  }

  return result;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx ts-node utils/validate-tcs-epics.ts <folder>');
    console.error('Example: npx ts-node utils/validate-tcs-epics.ts bmfs/works/bchp');
    process.exit(1);
  }

  const folder = args[0];
  if (!fs.existsSync(folder)) {
    console.error(`Folder not found: ${folder}`);
    process.exit(1);
  }

  const epicsPath = path.join(folder, '_epics.yaml');
  if (!fs.existsSync(epicsPath)) {
    console.error(`_epics.yaml not found in ${folder}`);
    console.error('Run: /bmf.create-epics to generate epics first');
    process.exit(1);
  }

  console.log('Validating epic/tc namespace consistency...\n');

  const result = validate(folder);

  // Summary
  console.log(`   Epics: ${result.epicIds.length}`);
  console.log(`   Test Cases: ${result.tcIds.length}`);
  console.log('');

  // Invalid epic IDs (3+ segments)
  if (result.invalidEpicIds.length > 0) {
    console.log(`ERROR: Invalid epic IDs (must be 2-segment "epic:domain"):\n`);
    for (const id of result.invalidEpicIds.sort()) {
      console.log(`   - ${id}`);
    }
    console.log('');
    console.log('   Fix: merge subepics into parent epic or rename to 2-segment format.');
    console.log('');
  }

  // Orphan tc domains (no matching epic)
  if (result.orphanTcDomains.length > 0) {
    console.log(`ERROR: TC domains without matching epic:\n`);
    for (const domain of result.orphanTcDomains.sort()) {
      const tcs = result.tcIds.filter(id => getDomain(id) === domain);
      console.log(`   epic:${domain} — missing (${tcs.length} tc:${domain}:* test cases reference it)`);
    }
    console.log('');
    console.log('   Fix: add missing epics to _epics.yaml or rename test cases to match existing epics.');
    console.log('');
  }

  // Empty epic domains (no tc coverage) — warning only
  if (result.emptyEpicDomains.length > 0) {
    console.log(`WARNING: Epics without test cases:\n`);
    for (const domain of result.emptyEpicDomains.sort()) {
      console.log(`   epic:${domain} — no tc:${domain}:* found`);
    }
    console.log('');
  }

  // Final status
  if (result.errors > 0) {
    console.log(`${result.errors} error(s) found`);
    process.exit(1);
  } else if (result.warnings > 0) {
    console.log(`All checks passed (${result.warnings} warning(s))`);
    process.exit(0);
  } else {
    console.log('All checks passed');
    process.exit(0);
  }
}

main();
