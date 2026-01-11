import fs from 'fs';
import YAML from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Load schema
const schema = JSON.parse(fs.readFileSync('schema.json', 'utf8'));
const ajv = new Ajv();
addFormats(ajv);
const validate = ajv.compile(schema);

// Test files
const files = [
  'templates/event.yaml',
  'templates/screen.yaml', 
  'specs/jumpster/events/system.yaml',
  'specs/jumpster/screens/onboarding.yaml'
];

files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const data = YAML.parse(content);
    const valid = validate(data);
    console.log(`${file}: ${valid ? 'VALID' : 'INVALID'}`);
    if (!valid) {
      console.log('  Errors:', JSON.stringify(validate.errors, null, 2));
    }
  } catch (e) {
    console.log(`${file}: ERROR - ${e.message}`);
  }
});