import type {PublicLocale} from "./public-content";

export function normalizeNickname(value:string){return value.normalize("NFKC").trim();}
export function nicknameKey(value:string){return normalizeNickname(value).toLowerCase();}
export function nicknameError(value:string,locale:PublicLocale="ko"):string|null {
 const nickname=normalizeNickname(value);
 if(!/^[A-Za-z0-9가-힣_]{2,20}$/.test(nickname))return locale==="en"?
  "Use 2–20 Korean or English letters, numbers, or underscores. Spaces are not allowed.":"닉네임은 한글·영문·숫자·밑줄 2~20자로 입력해주세요. 공백은 사용할 수 없습니다.";
 if(/^(admin|administrator|moderator|system|staff|official|malmoim|formermember|관리자|운영자|운영진|시스템|공식|말모임|탈퇴한회원)/.test(nicknameKey(nickname).replace(/_/g,"")))return locale==="en"?
  "This nickname is reserved. Choose a name that does not suggest an official account.":"공식 계정으로 오인될 수 있거나 예약된 닉네임입니다. 다른 이름을 입력해주세요.";
 return null;
}

// Only a trusted server/DB marker denotes withdrawal. Missing names are not proof
// of withdrawal. Never synthesize a name from private Auth/profile fields.
export function communityAuthorName(name:string|null|undefined,locale:PublicLocale="ko",withdrawn=false){
 if(withdrawn||name==="탈퇴한 회원")return locale==="en"?"Former Member":"탈퇴한 회원";
 return name||(locale==="en"?"Member":"회원");
}
