import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
 async rewrites() { return { beforeFiles: [{source:'/.well-known/oauth-authorization-server/api/mcp-authorization',destination:'/api/mcp-authorization/.well-known/oauth-authorization-server'}], afterFiles: [], fallback: [] }; },
 async headers() { return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},{key:'X-Frame-Options',value:'DENY'}]}]; },
};
export default nextConfig;
