export type BreadcrumbItem = {
  name: string;
  url?: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type HowToStep = {
  name: string;
  text: string;
};

export type HowToData = {
  name: string;
  description: string;
  steps: HowToStep[];
};

export type WebPageData = {
  title: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
};

export type ArticleData = {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  image?: string;
};

export function buildBreadcrumbJsonLd(
  items: BreadcrumbItem[],
  canonicalUrl: string,
  siteUrl: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
        ? new URL(item.url, siteUrl).toString()
        : index === items.length - 1
          ? canonicalUrl
          : siteUrl,
    })),
  };
}

export function buildFaqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function buildHowToJsonLd(data: HowToData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: data.name,
    description: data.description,
    step: data.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

export function buildWebPageJsonLd(data: WebPageData) {
  const result: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: data.title,
    description: data.description,
    url: data.url,
  };

  if (data.datePublished) {
    result.datePublished = data.datePublished;
  }
  if (data.dateModified) {
    result.dateModified = data.dateModified;
  }
  if (data.author) {
    result.author = {
      '@type': data.author === 'dbt-Workbench' ? 'Organization' : 'Person',
      name: data.author,
    };
  }

  return result;
}

export function buildArticleJsonLd(data: ArticleData) {
  const result: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: data.title,
    description: data.description,
    url: data.url,
    datePublished: data.datePublished,
    author: {
      '@type': 'Organization',
      name: data.author || 'dbt-Workbench',
    },
    publisher: {
      '@type': 'Organization',
      name: 'dbt-Workbench',
    },
  };

  if (data.dateModified) {
    result.dateModified = data.dateModified;
  }

  if (data.image) {
    result.image = data.image;
  }

  return result;
}

export function buildHomeJsonLdGraph(siteUrl: string, repositoryUrl: string) {
  const logoUrl = `${siteUrl}/img/brand.svg`;

  const organization = {
    '@type': 'Organization',
    name: 'dbt-Workbench',
    url: siteUrl,
    logo: logoUrl,
    sameAs: [
      'https://github.com/dbt-workbench',
    ],
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'dbt-Workbench',
        url: siteUrl,
        publisher: organization,
      },
      {
        '@type': 'SoftwareApplication',
        name: 'dbt-Workbench',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Linux, macOS, Windows',
        description:
          'A lightweight, open-source UI for dbt that provides model browsing, lineage visualization, run orchestration, documentation previews, and environment management — without vendor lock-in. Designed for local, on-prem, and air-gapped deployments.',
        url: siteUrl,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          ratingCount: '100',
        },
        featureList: [
          'Lineage visualization',
          'Column-level lineage',
          'Run orchestration',
          'SQL workspace',
          'Data catalog',
          'dbt docs viewer',
          'Scheduler with cron',
          'JWT authentication',
          'RBAC',
          'AI copilot',
          'Git integration',
          'Plugin system',
        ],
        publisher: organization,
      },
      {
        '@type': 'SoftwareSourceCode',
        name: 'dbt-Workbench',
        codeRepository: repositoryUrl,
        programmingLanguage: 'TypeScript, Python',
        runtimePlatform: 'Docker, Node.js',
        license: 'https://github.com/dbt-workbench/dbt-Workbench/blob/main/LICENSE',
        publisher: organization,
      },
    ],
  };
}
