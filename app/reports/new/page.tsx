import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { serverClient } from '@/lib/supabase/server';
import { ReportForm } from '@/components/forms';
export const metadata={title:'Share a finding'};
export default async function NewReport() {
 const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user) redirect('/login?next=/reports/new');
 return <div className="narrow-page"><Link href="/" className="back-link"><ArrowLeft size={15}/>Search findings</Link><div className="page-intro"><h1>Share a finding</h1><p>Share a clue, question, or partial investigation. Say what happened and what you know so far.</p></div><ReportForm/></div>;
}
