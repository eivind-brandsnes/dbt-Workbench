import React from 'react';
import Head from '@docusaurus/Head';
import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function Root({children}: {children: React.ReactNode}) {
  const {siteConfig} = useDocusaurusContext();
  const {pathname} = useLocation();
  const canonicalUrl = new URL(pathname, siteConfig.url).toString();

  return (
    <>
      <Head>
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hrefLang="en" href={canonicalUrl} />
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      </Head>
      {children}
    </>
  );
}
