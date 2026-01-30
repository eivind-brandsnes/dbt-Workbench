import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const repository = process.env.GITHUB_REPOSITORY ?? 'dbt-workbench/dbt-Workbench';
const [organizationName, projectName] = repository.split('/');
const siteUrl = `https://${organizationName}.github.io`;
const baseUrl = organizationName === 'dbt-workbench' ? '/' : `/${projectName}/`;
const ga4Id = process.env.GA4_ID;

const config: Config = {
  title: 'dbt-Workbench',
  tagline:
    'Open source dbt UI for lineage visualization, run orchestration, catalogs, and SQL workspace.',
  favicon: 'img/brand.svg',
  url: siteUrl,
  baseUrl,
  trailingSlash: true,
  organizationName,
  projectName,
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },
  future: {
    v4: true,
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: `https://github.com/${organizationName}/${projectName}/edit/main/website/`,
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**', '/search/**'],
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en'],
        docsRouteBasePath: '/docs',
        indexDocs: true,
        indexPages: true,
      },
    ],
    ga4Id
      ? [
        '@docusaurus/plugin-google-gtag',
        {
          trackingID: ga4Id,
          anonymizeIP: true,
        },
      ]
      : null,
  ].filter(Boolean),
  themeConfig: {
    image: 'img/og-image.svg',
    metadata: [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'robots', content: 'index, follow' },
    ],
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'dbt-Workbench',
      logo: {
        alt: 'dbt-Workbench logo',
        src: 'img/brand.svg',
      },
      items: [
        { to: '/docs/quickstart-docker/', label: 'Quickstart', position: 'left' },
        {
          to: '/docs/lineage-overview/',
          label: 'Lineage',
          position: 'left',
        },
        { to: '/docs/scheduler/', label: 'Scheduler', position: 'left' },
        { to: '/docs/sql-workspace/', label: 'SQL Workspace', position: 'left' },
        { to: '/docs/auth-rbac/', label: 'Auth & RBAC', position: 'left' },
        { type: 'search', position: 'right' },
        {
          href: `https://github.com/${organizationName}/${projectName}`,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'dbt UI Pillar', to: '/docs/dbt-ui/' },
            { label: 'Run Orchestration', to: '/docs/run-orchestration/' },
            { label: 'Air-gapped & On-Prem', to: '/docs/air-gapped-on-prem/' },
          ],
        },
        {
          title: 'Guides',
          items: [
            { label: 'View dbt lineage locally', to: '/docs/guides/view-dbt-lineage-locally/' },
            { label: 'Schedule dbt runs with cron', to: '/docs/guides/schedule-dbt-runs-with-cron/' },
            { label: 'Enable JWT auth', to: '/docs/guides/enable-jwt-auth/' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Analytics Setup', to: '/docs/analytics-setup/' },
            {
              label: 'GitHub',
              href: `https://github.com/${organizationName}/${projectName}`,
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} dbt-Workbench. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
