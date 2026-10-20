import {AdminShell} from '@/components/admin/admin-shell';
import {DocumentAdminPreview} from './document-admin-preview';

/** Mounted only after ProtectedAdmin verifies the existing administrator session. */
export function EsignAdminDemo({email}:{email:string}) {
 return <AdminShell email={email} current="esign-demo" title="전자서명 · 개발 시연"><DocumentAdminPreview browserOnly/></AdminShell>;
}
