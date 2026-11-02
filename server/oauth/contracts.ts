import type { Identity } from '@/server/services/auth';
export const OAUTH_RESOURCE='https://tokenoverflow.app/api/mcp' as const;
export const OAUTH_OPERATION_SCOPES=Object.freeze({publish_report:'reports:publish',publish_fix:'fixes:publish',record_verification:'verifications:record'} as const);
export type OAuthOperation=keyof typeof OAUTH_OPERATION_SCOPES;
export type OAuthScope=typeof OAUTH_OPERATION_SCOPES[OAuthOperation];
export type OAuthStatus=400|401|403|404|409|413|429|500|503;
const SAFE_CODES={400:'BAD_REQUEST',401:'UNAUTHORIZED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',413:'PAYLOAD_TOO_LARGE',429:'TOO_MANY_REQUESTS',500:'INTERNAL_SERVER_ERROR',503:'SERVICE_UNAVAILABLE'} as const;
export class OAuthBoundaryError extends Error {readonly code:typeof SAFE_CODES[OAuthStatus];constructor(readonly status:OAuthStatus){super(status===503?'Native authorization is unavailable.':status===401?'Authorization required.':status===403?'Permission denied.':'Could not complete the request.');this.code=SAFE_CODES[status];this.name='OAuthBoundaryError';}}
export function safeOAuthBoundaryError(error:unknown):OAuthBoundaryError{return error instanceof OAuthBoundaryError?error:new OAuthBoundaryError(500);}
export const OAUTH_MODELS=['Session','Interaction','Grant','AuthorizationCode','AccessToken','RefreshToken','Client'] as const;
export type OAuthModel=typeof OAUTH_MODELS[number];
export type OAuthPayload=Record<string,unknown>;
export type OAuthStaticClient=Readonly<{client_id:string;redirect_uris:readonly string[];response_types:readonly ['code'];grant_types:readonly ('authorization_code'|'refresh_token')[];token_endpoint_auth_method:'none'}>;
export type OAuthTrustedClient=Readonly<{clientId:string;redirectUris:readonly string[];scopes:readonly OAuthScope[];renewable:boolean}>;
export type OAuthPolicy=Readonly<{enabled:boolean;issuer:string;resource:typeof OAUTH_RESOURCE;clients:readonly OAuthTrustedClient[];ttl:Readonly<{authorizationCodeSeconds:120;accessTokenSeconds:600;interactionSeconds:600;refreshIdleSeconds:604800;refreshFamilySeconds:2592000}>}>;
export const OAUTH_DISABLED_POLICY:OAuthPolicy=Object.freeze({enabled:false,issuer:'',clients:Object.freeze([]),resource:OAUTH_RESOURCE,ttl:Object.freeze({authorizationCodeSeconds:120,accessTokenSeconds:600,interactionSeconds:600,refreshIdleSeconds:604800,refreshFamilySeconds:2592000})});
export type OAuthStoredRecord=Readonly<{payload:OAuthPayload;expiresAt:number;consumed?:number}>;
export type OAuthGrantBinding=Readonly<{interactionUid:string;providerGrantId:string;generationId:string;accountId:string;clientId:string;resource:typeof OAUTH_RESOURCE;scopes:readonly OAuthScope[];renewable:boolean}>;
export type OAuthDisconnectInput=Readonly<{verifiedWebActor:Identity;clientId:string}>;
export type OAuthDisconnectReceipt=Readonly<{clientId:string;disconnected:boolean}>;
export type OAuthApprovalInput=Readonly<{interactionUid:string;providerGrantId:string;verifiedWebActor:Identity}>;
export type OAuthAccessContext=Readonly<{credentialHash:string;grantId:string;clientId:string;accountId:string;resource:typeof OAUTH_RESOURCE;scope:readonly string[];exp:number;sessionUid?:string;expiresWithSession?:boolean}>;
export type OAuthContributionKind='report'|'fix'|'verification';
export type OAuthContributionReceipt=Readonly<{status:201;id:string;kind:OAuthContributionKind;url?:string}>;
// Every operation is one committed READ COMMITTED DB transaction; replay outcome is returned, not raised/rolled back.
export interface OAuthStore {
 readonly policy:OAuthPolicy;
 disconnectOAuthClient(input:OAuthDisconnectInput):Promise<OAuthDisconnectReceipt>;
 findActiveGrant(providerGrantId:string):Promise<OAuthGrantBinding|undefined>;
 upsert(model:Exclude<OAuthModel,'Client'>,keyHash:string,payload:OAuthPayload,ttl:number):Promise<void>;
 find(model:Exclude<OAuthModel,'Client'>,keyHash:string):Promise<OAuthStoredRecord|undefined>;
 findByIndex(model:Exclude<OAuthModel,'Client'>,index:'uid'|'userCode',value:string):Promise<OAuthStoredRecord|undefined>;
 consume(model:Exclude<OAuthModel,'Client'>,keyHash:string):Promise<'consumed'|'invalid'|'replay-terminalized'>;
 destroy(model:Exclude<OAuthModel,'Client'>,keyHash:string):Promise<void>;
 revokeByGrantId(grantId:string):Promise<void>;
 approveOAuthGrant(input:OAuthApprovalInput):Promise<OAuthGrantBinding>;
 checkAccess(context:OAuthAccessContext,operation:OAuthOperation):Promise<void>;
 publish(context:OAuthAccessContext,kind:OAuthContributionKind,data:unknown):Promise<OAuthContributionReceipt>;
}
export type ProjectedAccessToken=Readonly<{grantId?:unknown;clientId?:unknown;accountId?:unknown;aud?:unknown;scope?:unknown;exp?:unknown;sessionUid?:unknown;expiresWithSession?:unknown}>;
export type OAuthTokenFinder=(opaqueAccessToken:string)=>Promise<ProjectedAccessToken|undefined>;
