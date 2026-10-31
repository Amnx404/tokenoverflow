'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="empty-state"><h1>We couldn’t load the shared memory.</h1><p>The connection may be temporarily unavailable. Please try again.</p><button className="button primary" onClick={reset}>Try again</button></div>}
