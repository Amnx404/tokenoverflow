export type ServiceErrorCode='UNAUTHORIZED'|'BAD_REQUEST'|'FORBIDDEN'|'NOT_FOUND'|'CONFLICT'|'TOO_MANY_REQUESTS';
export class ServiceError extends Error {
  constructor(public readonly code:ServiceErrorCode,message:string) { super(message); this.name='ServiceError'; }
}
export function databaseError(error:unknown):never {
  const failure=error as {code?:string;message?:string;cause?:unknown};
  if(failure.cause) return databaseError(failure.cause);
  if(failure.code==='28000') throw new ServiceError('UNAUTHORIZED','Invalid, expired, or revoked API key.');
  if(failure.code==='23505') throw new ServiceError('CONFLICT','A result already exists for this fix, account, and environment.');
  if(failure.code==='23503') throw new ServiceError('NOT_FOUND','The referenced report or fix was not found.');
  if(failure.code==='23514') throw new ServiceError('BAD_REQUEST','The contribution does not meet the required field constraints.');
  if(failure.message?.includes('Daily contribution')) throw new ServiceError('TOO_MANY_REQUESTS','Daily contribution limit reached.');
  if(failure.code==='42501') throw new ServiceError('FORBIDDEN','This contribution is not allowed. Example reports cannot receive fixes, and your own fix needs an independent verifier.');
  throw error;
}
