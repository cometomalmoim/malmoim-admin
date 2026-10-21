export type MetaRegistrationReceipt={eventId:string;event:'season9'|'halloween-2026';language:'ko'|'en'};
/** Only call after the database has confirmed this submission. No applicant fields. */
export function registrationReceipt(event:MetaRegistrationReceipt['event'],submission:string,language:unknown):MetaRegistrationReceipt|undefined{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submission))return;
 return {eventId:`registration:${event}:${submission.toLowerCase()}`,event,language:language==='en'?'en':'ko'};
}
