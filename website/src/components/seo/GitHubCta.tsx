import React from 'react';
import Link from '@docusaurus/Link';

export type GitHubCtaPosition = 'top' | 'bottom' | 'inline';

export type GitHubCtaProps = {
  position: GitHubCtaPosition;
  campaign?: string;
  label?: string;
  href?: string;
};

const DEFAULT_REPOSITORY_URL = 'https://github.com/rezer-bleede/dbt-Workbench';

function buildTrackedHref(href: string, campaign: string) {
  try {
    const parsed = new URL(href);
    parsed.searchParams.set('utm_source', 'docs');
    parsed.searchParams.set('utm_medium', 'organic');
    parsed.searchParams.set('utm_campaign', campaign);
    return parsed.toString();
  } catch {
    return href;
  }
}

export default function GitHubCta({
  position,
  campaign = 'repo_cta',
  label = 'View dbt-Workbench on GitHub',
  href = DEFAULT_REPOSITORY_URL,
}: GitHubCtaProps) {
  const trackedHref = buildTrackedHref(href, campaign);

  return (
    <div className={`github-cta github-cta--${position}`}>
      <Link to={trackedHref}>{label}</Link>
    </div>
  );
}
