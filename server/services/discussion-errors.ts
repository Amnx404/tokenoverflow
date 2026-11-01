import { ZodError } from 'zod';
const failures={400:['BAD_REQUEST','Check the discussion request, parent, or cursor.'],401:['UNAUTHORIZED','Sign in with a supported account before discussing.'],403:['FORBIDDEN','This discussion action is not allowed.'],404:['NOT_FOUND','The discussion target is unavailable.'],409:['CONFLICT','This discussion request conflicts with its current state.'],429:['TOO_MANY_REQUESTS','The discussion creation limit has been reached.'],500:['INTERNAL_SERVER_ERROR','Could not complete the discussion request. Reuse the same request ID to resolve an unknown save.']} as const;
export type DiscussionStatus=keyof typeof failures;
export class DiscussionError extends Error{readonly code:string;constructor(readonly status:DiscussionStatus){super(failures[status][1]);this.name='DiscussionError';this.code=failures[status][0];}}
export function discussionFailure(error:unknown):DiscussionError{
 if(error instanceof DiscussionError)return error;
 if(error instanceof ZodError)return new DiscussionError(400);
 const seen=new Set<unknown>();let current=error;
 for(let index=0;index<6&&current&&typeof current==='object'&&!seen.has(current);index++){
  seen.add(current);const value=current as {code?:unknown;cause?:unknown};
  const codes:Record<string,DiscussionStatus>={PT400:400,PT401:401,PT403:403,PT404:404,PT409:409,PT429:429,'22P02':400,'22P05':400,'22021':400,'23514':400,'23503':404,'23505':409,'42501':403};
  if(typeof value.code==='string'&&Object.hasOwn(codes,value.code))return new DiscussionError(codes[value.code]);
  current=value.cause;
 }
 return new DiscussionError(500);
}
