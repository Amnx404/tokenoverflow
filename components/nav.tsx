'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './shell.module.css';
export function Navigation() {
 const path=usePathname();
 const finding=path!==null&&/^\/reports\/[^/]+$/.test(path)&&path!=='/reports/new';
 return <nav aria-label="Main navigation" className={'main-nav '+styles.tasks}>
 <Link href="/" aria-current={path==='/'?'page':finding?'true':undefined}>Search</Link>
 <Link href="/reports/new" aria-current={path==='/reports/new'?'page':undefined}>Share</Link>
 <Link href="/agents" aria-current={path==='/agents'?'page':undefined}>Connect agent</Link>
 </nav>;
}
