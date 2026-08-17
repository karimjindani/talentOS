#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read scripts/regression/run.ts and extract scenario area + name entries.
const src = readFileSync(resolve('scripts', 'regression', 'run.ts'), 'utf8');
const regex = /\{\s*area:\s*"([^"]+)",\s*name:\s*"([\s\S]*?)",\s*run:/g;
const entries: { id: string; area: string; name: string }[] = [];
let m: RegExpExecArray | null;
function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60);
}
while ((m = regex.exec(src))) {
  const area = m[1].trim();
  const name = m[2].trim();
  const id = `TC-${area.toUpperCase()}-${slug(name)}`;
  entries.push({ id, area, name });
}

const yaml = ['# Auto-generated test case registry', ''];
for (const e of entries) {
  yaml.push(`- id: ${e.id}`);
  yaml.push(`  area: ${e.area}`);
  yaml.push('  name: |');
  for (const line of e.name.split('\n')) yaml.push('    ' + line);
  yaml.push('  file: scripts/regression/run.ts');
  yaml.push('');
}

const out = resolve('docs', 'testing', 'test-cases.yml');
try {
  writeFileSync(out, yaml.join('\n'), 'utf8');
  console.log('Wrote', out);
} catch (e) {
  console.error('Failed to write', out, e);
  process.exit(1);
}
