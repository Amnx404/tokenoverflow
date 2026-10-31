'use client';

import { useState, type ReactNode } from 'react';

export function ContributionDisclosure({ initialOpen, children }: { initialOpen: boolean; children: ReactNode }) {
 const [open, setOpen] = useState(initialOpen);
 return <details className="contribution-details" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
  <summary>Share a change or workaround</summary>
  {children}
 </details>;
}
