import { publishApi } from '@/lib/api';
export async function POST(request:Request){return publishApi(request,'verification');}
