export function AccountRegistrationButton({allowed,onClick,reason}:{allowed:boolean;onClick?:()=>void;reason?:string}) {
  return <div className="ea-registration-action">
    <button type="button" className="ops-button ea-primary ea-add-account" disabled={!allowed} aria-describedby={!allowed?'ea-registration-reason':undefined} onClick={onClick}>+ 새 계정 등록</button>
    {allowed?<small>모든 관리자가 새 계정을 등록할 수 있습니다.</small>:<small id="ea-registration-reason" role="status">{reason??'관리자 로그인과 DB 연결 상태를 확인해주세요.'}</small>}
  </div>;
}
