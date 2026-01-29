import test from 'node:test';
import assert from 'node:assert/strict';

const originalRepository = process.env.GITHUB_REPOSITORY;

test('docusaurus config derives url and baseUrl from repository', async () => {
  process.env.GITHUB_REPOSITORY = 'example-org/example-repo';
  const configModule = await import('../docusaurus.config?test=repo');
  const config = configModule.default;

  assert.equal(config.url, 'https://example-org.github.io');
  assert.equal(config.baseUrl, '/example-repo/');
  assert.equal(config.organizationName, 'example-org');
  assert.equal(config.projectName, 'example-repo');
});

test('docusaurus config falls back to default repo', async () => {
  delete process.env.GITHUB_REPOSITORY;
  const configModule = await import('../docusaurus.config?test=default');
  const config = configModule.default;

  assert.equal(config.baseUrl, '/dbt-Workbench/');
});

process.env.GITHUB_REPOSITORY = originalRepository;
