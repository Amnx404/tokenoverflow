export type PublicDiscussionComment={id:string;report_id:string;parent_id:string|null;root_id:string;depth:number;author_name:string|null;body:string|null;created_at:string;redacted_at:string|null};
export type DiscussionPage={report_id:string;parent_id:string|null;parent:PublicDiscussionComment|null;ancestors:PublicDiscussionComment[];comments:PublicDiscussionComment[];has_more:boolean;next_cursor:string|null};
export type DiscussionContext={report_id:string;status:'available'|'unavailable';comment:PublicDiscussionComment|null;ancestors:PublicDiscussionComment[]};
export type DiscussionReceipt={request_id?:string;id:string;report_id:string;parent_id:string|null;root_id:string;depth:number;created_at:string;redacted_at:string|null;url:string};
export type DiscussionActionState={receipt?:DiscussionReceipt;request_id?:string;error?:{status:number;code:string;message:string}};
