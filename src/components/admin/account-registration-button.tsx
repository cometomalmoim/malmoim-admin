export function AccountRegistrationButton({allowed,onClick,reason}:{allowed:boolean;onClick?:()=>void;reason?:string}) {
  return <div className="ea-registration-action">
    <button type="button" className="ops-button ea-primary ea-add-account" disabled={!allowed} aria-describedby={!allowed?'ea-registration-reason':undefined} onClick={onClick}>+ 새 계정 등록</button>
    {!allowed&&<small id="ea-registration-reason" role="status">{reason??'계정 등록은 Master Admin만 가능합니다. 권한이 필요한 경우 관리자에게 요청해주세요.'}</small>}
  </div>;
}
