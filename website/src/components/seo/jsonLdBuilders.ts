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

export function buildHomeJsonLdGraph(siteUrl: string, repositoryUrl: string) {
  const organization = {
    '@type': 'Organization',
    name: 'dbt-Workbench',
    url: siteUrl,
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'dbt-Workbench',
        url: siteUrl,
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
        publisher: organization,
      },
      {
        '@type': 'SoftwareSourceCode',
        name: 'dbt-Workbench',
        codeRepository: repositoryUrl,
        programmingLanguage: 'TypeScript',
        runtimePlatform: 'Docker, Node.js',
        publisher: organization,
      },
    ],
  };
}
