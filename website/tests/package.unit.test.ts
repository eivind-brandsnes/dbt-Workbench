import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const packageJsonUrl = new URL('../package.json', import.meta.url);

test('website package.json declares Docusaurus build script and dependencies', async () => {
  const raw = await readFile(packageJsonUrl, 'utf-8');
  const pkg = JSON.parse(raw) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    type?: string;
  };

  assert.equal(pkg.type, 'module');
  assert.equal(pkg.scripts?.build, 'docusaurus build');
  assert.equal(pkg.dependencies?.['@docusaurus/core'], '3.9.2');
});
