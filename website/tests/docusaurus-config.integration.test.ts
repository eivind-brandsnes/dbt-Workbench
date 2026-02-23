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

test('docusaurus config uses repository for GitHub navbar link', async () => {
  process.env.GITHUB_REPOSITORY = 'octo-org/octo-repo';
  const configModule = await import('../docusaurus.config?test=navbar');
  const config = configModule.default;

  const githubItem = config.themeConfig?.navbar?.items?.find(
    (item) => typeof item === 'object' && 'href' in item && item.href?.includes('github.com'),
  );

  assert.equal(
    githubItem?.href,
    'https://github.com/octo-org/octo-repo?utm_source=docs&utm_medium=organic&utm_campaign=repo_cta',
  );
});

test('docusaurus config falls back to default repo', async () => {
  delete process.env.GITHUB_REPOSITORY;
  const configModule = await import('../docusaurus.config?test=default');
  const config = configModule.default;

  assert.equal(config.baseUrl, '/dbt-Workbench/');
});

test('docusaurus sitemap config excludes local search routes', async () => {
  process.env.GITHUB_REPOSITORY = 'example-org/example-repo';
  const configModule = await import('../docusaurus.config?test=sitemap');
  const config = configModule.default;
  const classicPreset = config.presets?.[0];
  const classicOptions =
    Array.isArray(classicPreset) && classicPreset.length > 1 ? classicPreset[1] : null;
  const ignorePatterns = classicOptions?.sitemap?.ignorePatterns ?? [];

  assert.deepEqual(ignorePatterns, ['/tags/**', '/search', '/search/', '/search/**']);
});

test('docusaurus config emits verification metadata when env vars are provided', async () => {
  process.env.GITHUB_REPOSITORY = 'example-org/example-repo';
  process.env.GOOGLE_SITE_VERIFICATION = 'google-token';
  process.env.BING_SITE_VERIFICATION = 'bing-token';
  const configModule = await import('../docusaurus.config?test=verification');
  const config = configModule.default;
  const metadata = config.themeConfig?.metadata ?? [];

  assert.equal(
    metadata.some(
      (item) =>
        typeof item === 'object' &&
        'name' in item &&
        item.name === 'google-site-verification' &&
        'content' in item &&
        item.content === 'google-token',
    ),
    true,
  );
  assert.equal(
    metadata.some(
      (item) =>
        typeof item === 'object' &&
        'name' in item &&
        item.name === 'msvalidate.01' &&
        'content' in item &&
        item.content === 'bing-token',
    ),
    true,
  );

  delete process.env.GOOGLE_SITE_VERIFICATION;
  delete process.env.BING_SITE_VERIFICATION;
});

process.env.GITHUB_REPOSITORY = originalRepository;
