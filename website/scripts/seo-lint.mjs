#!/usr/bin/env node

import {promises as fs} from 'node:fs';
import path from 'node:path';

const docsDir = path.resolve(process.cwd(), 'docs');
const requiredFrontmatterKeys = [
  'title',
  'description',
  'keywords',
  'slug',
  'seo_primary_keyword',
  'seo_intent',
  'last_reviewed',
];
const allowedSeoIntent = new Set(['informational', 'comparison', 'tutorial', 'use-case']);
const canonicalOwner = 'rezer-bleede/dbt-Workbench';
const legacyOwner = `${['dbt', 'workbench'].join('-')}/dbt-Workbench`;
/** @type {{file: string; severity: 'error' | 'warning'; rule: string; message: string}[]} */
const findings = [];

function addFinding(file, severity, rule, message) {
  findings.push({file, severity, rule, message});
}

async function listDocFiles(root) {
  const output = [];
  const entries = await fs.readdir(root, {withFileTypes: true});
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await listDocFiles(full)));
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      output.push(full);
    }
  }
  return output;
}

function extractFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  return match ? match[1] : null;
}

function hasFrontmatterKey(frontmatter, key) {
  const keyPattern = new RegExp(`^${key}:\\s*.+$`, 'm');
  return keyPattern.test(frontmatter);
}

function frontmatterValue(frontmatter, key) {
  const keyPattern = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = frontmatter.match(keyPattern);
  return match?.[1]?.trim() ?? null;
}

function isClusterPage(relativePath) {
  return (
    relativePath.startsWith('comparisons/') ||
    relativePath.startsWith('use-cases/') ||
    relativePath.startsWith('tutorials/')
  );
}

function expectedIntent(relativePath) {
  if (relativePath.startsWith('comparisons/')) return 'comparison';
  if (relativePath.startsWith('use-cases/')) return 'use-case';
  if (relativePath.startsWith('tutorials/')) return 'tutorial';
  return null;
}

function countInternalDocLinks(text) {
  const markdownLinks = text.match(/\]\(\/docs\/[^)\s]+\)/g) ?? [];
  const mdxLinks = text.match(/to=\"\/docs\/[^\"]+\"/g) ?? [];
  return markdownLinks.length + mdxLinks.length;
}

function countGithubCtas(text) {
  const ctaTags = text.match(/<GitHubCta\b/g) ?? [];
  return ctaTags.length;
}

async function run() {
  const docFiles = await listDocFiles(docsDir);

  for (const file of docFiles) {
    const relative = path.relative(docsDir, file).replaceAll(path.sep, '/');
    const text = await fs.readFile(file, 'utf8');
    const frontmatter = extractFrontmatter(text);

    if (!frontmatter) {
      addFinding(relative, 'error', 'frontmatter.required', 'Missing YAML frontmatter block.');
      continue;
    }

    for (const key of requiredFrontmatterKeys) {
      if (!hasFrontmatterKey(frontmatter, key)) {
        addFinding(relative, 'error', 'frontmatter.required_keys', `Missing required frontmatter key: ${key}.`);
      }
    }

    const seoIntent = frontmatterValue(frontmatter, 'seo_intent')?.replace(/^["']|["']$/g, '');
    if (seoIntent && !allowedSeoIntent.has(seoIntent)) {
      addFinding(
        relative,
        'error',
        'frontmatter.seo_intent',
        `Invalid seo_intent "${seoIntent}". Allowed: informational, comparison, tutorial, use-case.`,
      );
    }

    const expected = expectedIntent(relative);
    if (expected && seoIntent && seoIntent !== expected) {
      addFinding(
        relative,
        'error',
        'frontmatter.seo_intent_path_mismatch',
        `Expected seo_intent "${expected}" for path "${relative}", got "${seoIntent}".`,
      );
    }

    const lastReviewed = frontmatterValue(frontmatter, 'last_reviewed')?.replace(/^["']|["']$/g, '');
    if (lastReviewed && !/^\d{4}-\d{2}-\d{2}$/.test(lastReviewed)) {
      addFinding(
        relative,
        'error',
        'frontmatter.last_reviewed_format',
        'last_reviewed must follow YYYY-MM-DD.',
      );
    }

    const keywordsValue = frontmatterValue(frontmatter, 'keywords');
    if (keywordsValue && keywordsValue.trim() === '[]') {
      addFinding(relative, 'error', 'frontmatter.keywords_empty', 'keywords must not be an empty array.');
    }

    if (text.includes(legacyOwner)) {
      addFinding(
        relative,
        'error',
        'links.legacy_owner',
        `Found legacy owner reference "${legacyOwner}". Use "${canonicalOwner}".`,
      );
    }

    if (text.includes('github.com') && text.includes('rezer-bleede/dbt-Workbench') && text.includes(legacyOwner)) {
      addFinding(
        relative,
        'error',
        'links.mixed_owner',
        'Found mixed GitHub owner references in the same file.',
      );
    }

    if (isClusterPage(relative)) {
      const ctaCount = countGithubCtas(text);
      if (ctaCount < 2) {
        addFinding(
          relative,
          'error',
          'content.cta_count',
          'Cluster pages must include at least two <GitHubCta /> components.',
        );
      }

      const internalLinkCount = countInternalDocLinks(text);
      if (internalLinkCount < 6) {
        addFinding(
          relative,
          'error',
          'content.internal_link_count',
          `Cluster pages must include at least 6 internal /docs/ links, found ${internalLinkCount}.`,
        );
      }

      if (!/campaign=/.test(text)) {
        addFinding(
          relative,
          'warning',
          'content.tracked_cta',
          'Cluster pages should set campaign on GitHubCta for UTM attribution.',
        );
      }
    }
  }

  const errors = findings.filter((entry) => entry.severity === 'error');
  if (errors.length > 0) {
    console.error(JSON.stringify(findings, null, 2));
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        checkedFiles: docFiles.length,
        warnings: findings.filter((entry) => entry.severity === 'warning').length,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify(
      [
        {
          file: 'global',
          severity: 'error',
          rule: 'lint.runtime',
          message,
        },
      ],
      null,
      2,
    ),
  );
  process.exit(1);
});
