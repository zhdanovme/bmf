#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, '..', 'schema.json');

interface ValidationResult {
  valid: boolean;
  file: string;
  errors: string[];
}

function findYamlFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function loadSchema(): object {
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  return JSON.parse(schemaContent);
}

function validateYamlFile(filePath: string, validateFn: (data: unknown) => boolean): ValidationResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = YAML.parse(content);

    const valid = validateFn(data);

    if (valid) {
      return { valid: true, file: filePath, errors: [] };
    } else {
      return {
        valid: false,
        file: filePath,
        errors: validateFn.errors?.map((err: any) => 
          `${err.instancePath} ${err.message || ''}`.trim()
        ) || ['Unknown validation error'],
      };
    }
  } catch (e) {
    return {
      valid: false,
      file: filePath,
      errors: [`Parse error: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

function validateFolders(folders: string[]): void {
  const schema = loadSchema();
  const ajvInstance = new Ajv({ allErrors: true });
  const validate = ajvInstance.compile(schema);

  let totalFiles = 0;
  let validFiles = 0;
  const allResults: ValidationResult[] = [];

  for (const folder of folders) {
    if (!fs.existsSync(folder)) {
      console.error(`❌ Folder not found: ${folder}`);
      continue;
    }

    console.log(`\n📂 Scanning: ${folder}`);
    const yamlFiles = findYamlFiles(folder);

    if (yamlFiles.length === 0) {
      console.log(`   No YAML files found`);
      continue;
    }

    console.log(`   Found ${yamlFiles.length} YAML file(s)\n`);

    for (const file of yamlFiles) {
      const relativePath = path.relative(process.cwd(), file);
      const result = validateYamlFile(file, validate);
      allResults.push(result);
      totalFiles++;

      if (result.valid) {
        console.log(`   ✅ ${relativePath}`);
        validFiles++;
      } else {
        console.log(`   ❌ ${relativePath}`);
        for (const error of result.errors) {
          console.log(`      - ${error}`);
        }
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Summary: ${validFiles}/${totalFiles} files valid`);

  if (validFiles < totalFiles) {
    console.log(`\n❌ Validation failed`);
    process.exit(1);
  } else {
    console.log(`\n✅ All files are valid`);
    process.exit(0);
  }
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run validate <folder1> <folder2> ...');
    console.error('Example: npm run validate specs/jumpster');
    process.exit(1);
  }

  validateFolders(args);
}

main();
