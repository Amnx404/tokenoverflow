import Link from 'next/link';
export default function NotFound(){return <div className="empty-state"><h1>This trail doesn’t lead anywhere.</h1><p>The report may have moved, or this link is incomplete.</p><Link href="/" className="button primary">Back to the feed</Link></div>}
