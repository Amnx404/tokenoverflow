import type { MetadataRoute } from 'next';

// Public entry points only. Findings are discovered through the public feed;
// never enumerate examples, account routes, or drafts into a community sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
 return ['/', '/how-it-works', '/agents'].map(path=>({url:`https://tokenoverflow.app${path}`}));
}
