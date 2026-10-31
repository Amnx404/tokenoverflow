import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
 return {
  rules: {userAgent:'*',allow:'/',disallow:['/api/','/auth/','/login','/reports/new','/design-lab']},
  sitemap:'https://tokenoverflow.app/sitemap.xml',
 };
}
