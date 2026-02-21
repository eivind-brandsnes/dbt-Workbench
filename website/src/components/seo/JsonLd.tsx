import React from 'react';
import Head from '@docusaurus/Head';
import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildHowToJsonLd,
  buildHomeJsonLdGraph,
  buildWebPageJsonLd,
  buildArticleJsonLd,
  BreadcrumbItem,
  FaqItem,
  HowToData,
  WebPageData,
  ArticleData,
} from './jsonLdBuilders';

type JsonLdProps = {
  data: Record<string, unknown>;
};

export function JsonLd({data}: JsonLdProps) {
  return (
    <Head>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Head>
  );
}

function getSiteBaseUrl(siteUrl: string, baseUrl: string) {
  return new URL(baseUrl, siteUrl).toString();
}

export function useCanonicalUrl() {
  const {siteConfig} = useDocusaurusContext();
  const {pathname} = useLocation();
  return new URL(pathname, siteConfig.url).toString();
}

export function BreadcrumbJsonLd({items}: {items: BreadcrumbItem[]}) {
  const canonicalUrl = useCanonicalUrl();
  const {siteConfig} = useDocusaurusContext();
  const siteBaseUrl = getSiteBaseUrl(siteConfig.url, siteConfig.baseUrl);

  return (
    <JsonLd
      data={buildBreadcrumbJsonLd(items, canonicalUrl, siteBaseUrl)}
    />
  );
}

export function FaqJsonLd({items}: {items: FaqItem[]}) {
  return <JsonLd data={buildFaqJsonLd(items)} />;
}

export function HowToJsonLd({name, description, steps}: HowToData) {
  return <JsonLd data={buildHowToJsonLd({name, description, steps})} />;
}

export function HomeJsonLd() {
  const {siteConfig} = useDocusaurusContext();
  const siteBaseUrl = getSiteBaseUrl(siteConfig.url, siteConfig.baseUrl);
  const repositoryUrl = `https://github.com/${siteConfig.organizationName}/${siteConfig.projectName}`;
  const organizationUrl = `https://github.com/${siteConfig.organizationName}`;

  return <JsonLd data={buildHomeJsonLdGraph(siteBaseUrl, repositoryUrl, organizationUrl)} />;
}

export function WebPageJsonLd({title, description, datePublished, dateModified}: WebPageData) {
  const canonicalUrl = useCanonicalUrl();

  return (
    <JsonLd
      data={buildWebPageJsonLd({
        title,
        description,
        url: canonicalUrl,
        datePublished,
        dateModified,
        author: 'dbt-Workbench',
      })}
    />
  );
}

export function ArticleJsonLd({title, description, datePublished, dateModified, image}: ArticleData) {
  const canonicalUrl = useCanonicalUrl();

  return (
    <JsonLd
      data={buildArticleJsonLd({
        title,
        description,
        url: canonicalUrl,
        datePublished,
        dateModified,
        author: 'dbt-Workbench',
        image,
      })}
    />
  );
}
