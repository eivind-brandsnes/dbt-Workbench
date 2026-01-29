import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildHowToJsonLd,
} from '../src/components/seo/jsonLdBuilders';

test('buildFaqJsonLd maps questions into FAQPage schema', () => {
  const data = buildFaqJsonLd([
    {question: 'What is dbt-Workbench?', answer: 'An open source dbt UI.'},
  ]);

  assert.equal(data['@type'], 'FAQPage');
  assert.equal((data.mainEntity as Array<{name: string}>)[0].name, 'What is dbt-Workbench?');
});

test('buildBreadcrumbJsonLd resolves URLs correctly', () => {
  const data = buildBreadcrumbJsonLd(
    [{name: 'Docs', url: '/docs/'}, {name: 'Page'}],
    'https://example.com/docs/page',
    'https://example.com',
  );

  assert.equal(data.itemListElement[0].item, 'https://example.com/docs/');
  assert.equal(data.itemListElement[1].item, 'https://example.com/docs/page');
});

test('buildHowToJsonLd creates ordered steps', () => {
  const data = buildHowToJsonLd({
    name: 'Test HowTo',
    description: 'Testing steps',
    steps: [
      {name: 'Step 1', text: 'Do first'},
      {name: 'Step 2', text: 'Do second'},
    ],
  });

  assert.equal(data['@type'], 'HowTo');
  assert.equal(data.step[1].position, 2);
});
