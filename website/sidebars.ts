import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: ['quickstart-docker', 'screenshots'],
    },
    {
      type: 'category',
      label: 'Core Documentation',
      items: [
        'dbt-ui',
        'lineage-overview',
        'column-lineage',
        'run-orchestration',
        'scheduler',
        'sql-workspace',
        'ai-overview',
        'ai-configuration',
        'ai-mcp-connectivity',
        'ai-security-rbac',
        'catalog',
        'docs-viewer',
        'artifacts',
        'environments',
        'auth-rbac',
        'air-gapped-on-prem',
      ],
    },
    {
      type: 'category',
      label: 'How-to Guides',
      items: [
        'guides/view-dbt-lineage-locally',
        'guides/mount-dbt-artifacts-into-ui',
        'guides/run-dbt-from-web-ui',
        'guides/schedule-dbt-runs-with-cron',
        'guides/debug-failed-dbt-runs',
        'guides/use-compiled-sql-safely',
        'guides/manage-multiple-dbt-projects',
        'guides/enable-jwt-auth',
        'guides/add-plugin',
        'guides/run-air-gapped',
        'guides/migrate-from-dbt-cloud',
        'guides/dbt-testing-guide',
        'guides/dbt-performance-optimization',
        'guides/dbt-security-compliance',
        'guides/dbt-best-practices',
        'guides/dbt-cicd-pipeline',
        'guides/dbt-troubleshooting-guide',
        'guides/dbt-documentation-guide',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: ['analytics-setup', 'architecture', 'plugin-system'],
    },
    {
      type: 'category',
      label: 'Project',
      items: ['contributing', 'roadmap', 'changelog'],
    },
  ],
};

export default sidebars;
