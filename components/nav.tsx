'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export function Navigation() {
 const path=usePathname();
 return <nav aria-label="Main navigation" className="main-nav">
 {path!=='/'&&<Link href="/">Search</Link>}
 <Link href="/reports/new" aria-current={path==='/reports/new'?'page':undefined}>Share finding</Link>
 <Link href="/agents" aria-current={path==='/agents'?'page':undefined}>Connect agent</Link>
 </nav>;
}
