import React from 'react';
import Head from '@docusaurus/Head';
import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildHomeJsonLdGraph,
  buildHowToJsonLd,
  BreadcrumbItem,
  FaqItem,
  HowToData,
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

export function useCanonicalUrl() {
  const {siteConfig} = useDocusaurusContext();
  const {pathname} = useLocation();
  return new URL(pathname, siteConfig.url).toString();
}

export function BreadcrumbJsonLd({items}: {items: BreadcrumbItem[]}) {
  const canonicalUrl = useCanonicalUrl();
  const {siteConfig} = useDocusaurusContext();

  return (
    <JsonLd
      data={buildBreadcrumbJsonLd(items, canonicalUrl, siteConfig.url)}
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
  const repositoryUrl = `https://github.com/${siteConfig.organizationName}/${siteConfig.projectName}`;

  return <JsonLd data={buildHomeJsonLdGraph(siteConfig.url, repositoryUrl)} />;
}
