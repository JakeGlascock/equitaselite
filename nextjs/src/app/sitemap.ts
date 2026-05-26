import type { MetadataRoute } from 'next'

// Next 15 metadata file. Renders /sitemap.xml with the public,
// crawlable surfaces. Keep in sync with the marketing-page list in
// the PUBLIC_EXACT array in middleware.ts.

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://equitaselite.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: `${BASE}/`,                changeFrequency: 'weekly',  priority: 1.0, lastModified },
    { url: `${BASE}/pricing`,         changeFrequency: 'monthly', priority: 0.8, lastModified },
    { url: `${BASE}/signin`,          changeFrequency: 'yearly',  priority: 0.5, lastModified },
    { url: `${BASE}/request-access`,  changeFrequency: 'yearly',  priority: 0.7, lastModified },
    { url: `${BASE}/privacy`,         changeFrequency: 'yearly',  priority: 0.3, lastModified },
    { url: `${BASE}/terms`,           changeFrequency: 'yearly',  priority: 0.3, lastModified },
  ]
}
