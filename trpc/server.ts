import 'server-only';
import { cache } from 'react';
import { createCaller } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';

export const api = createCaller(cache(createTRPCContext));
