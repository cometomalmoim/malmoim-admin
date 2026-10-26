const messages:Record<string,[string,string]>={
 PHOTO_INPUT_TOO_LARGE:['원본 파일이 4MiB를 초과합니다. 파일 용량을 줄여주세요.','The original file exceeds 4 MiB. Reduce its file size.'],
 PHOTO_OUTPUT_TOO_LARGE:['변환된 사진이 4MiB를 초과합니다. 더 작은 사진을 선택해주세요.','The converted photo exceeds 4 MiB. Choose a smaller image.'],
 PHOTO_PIXEL_LIMIT:['사진이 2,400만 픽셀 제한을 초과합니다. 가로·세로 크기를 줄인 뒤 다시 선택해주세요.','The photo exceeds the 24-megapixel limit. Resize its pixel dimensions first.'],
 PHOTO_FORMAT_UNSUPPORTED:['실제 파일 형식이 JPG·PNG·WebP가 아닙니다. HEIC 등은 JPG로 내보내주세요.','The actual image format is not JPG, PNG or WebP. Export HEIC or other formats as JPEG.'],
 PHOTO_ANIMATION_UNSUPPORTED:['움직이는 이미지나 여러 페이지 이미지는 지원하지 않습니다. 정지 사진을 선택해주세요.','Animated or multipage images are not supported. Choose a still image.'],
 PHOTO_DECODER_UNAVAILABLE:['서버 이미지 처리 모듈을 불러오지 못했습니다. 운영 배포의 sharp 구성을 확인해주세요.','The server image module could not load. Check sharp in the production deployment.'],
 PHOTO_CONVERSION_FAILED:['서버의 WebP 변환에 실패했습니다. 원본 파일을 보존하고 서버 변환 상태를 확인해주세요.','Server WebP conversion failed. Keep the original file and check the conversion service.'],
 ADMIN_REQUIRED:['관리자 로그인이 필요합니다. 다시 로그인해주세요.','Please sign in as an administrator again.'],
 ORIGIN_DENIED:['요청한 사이트 주소가 일치하지 않습니다. 실제 홈페이지에서 다시 시도해주세요.','The request origin was rejected. Open the official website and try again.'],
 PERSONAL_TEST_DISABLED:['사진 기능이 비활성화되어 있습니다. 운영 설정을 확인해주세요.','Photo management is disabled. Check the production configuration.'],
 INVALID_INPUT:['필수 항목·날짜·활동 유형·기수를 확인해주세요.','Check the required fields, date, activity type and season.'],
 INVALID_IMAGE:['이미지를 해석하지 못했습니다. 정상적인 JPG·PNG·WebP 파일을 선택해주세요.','The image could not be decoded. Choose a valid JPG, PNG or WebP file.'],
 BODY_TOO_LARGE:['파일이 요청 용량 제한을 초과했습니다. 더 작은 사진을 선택해주세요.','The request exceeded the size limit. Choose a smaller image.'],
 PHOTO_FILES_INVALID:['사진은 1~10장, 장당 4MiB 이하 JPG·PNG·WebP를 선택해주세요.','Select 1–10 JPG, PNG or WebP files, each no larger than 4 MiB.'],
 PHOTO_FILES_DUPLICATE:['같은 사진이 중복 선택되었습니다. 파일을 확인해주세요.','The same photo was selected more than once.'],
 PHOTO_LIMIT:['활동당 사진은 최대 10장입니다.','Each activity supports up to 10 photos.'],
 PHOTO_NOT_READY:['업로드가 완료되지 않은 사진이 있어 공개하지 않았습니다.','The album was not published because some photos are not ready.'],
 PHOTO_PERMISSION_DENIED:['사진 데이터 또는 Storage 권한이 거부되었습니다. 관리자 등록과 RLS를 확인해주세요.','Database or Storage access was denied. Check administrator membership and RLS.'],
 PHOTO_SCHEMA_MISMATCH:['사진 테이블 또는 컬럼이 현재 코드와 일치하지 않습니다. 운영 스키마를 확인해주세요.','Photo tables or columns do not match this application version.'],
 PHOTO_STORAGE_FAILED:['Storage 업로드가 실패했습니다. 버킷 상태와 권한을 확인해주세요.','Storage upload failed. Check bucket availability and permissions.'],
 PHOTO_UNAVAILABLE:['사진 데이터를 저장하거나 조회하지 못했습니다. 서버 상태를 확인해주세요.','Photo data could not be saved or loaded. Check the server status.'],
 PHOTO_UNCERTAIN:['저장 결과를 확인하지 못했습니다. 자동 재시도하지 말고 목록을 확인해주세요.','The save result is unconfirmed. Check the list before retrying.'],
 PHOTO_RESULT_UNCONFIRMED:['서버에서 처리 결과를 확인하지 못했습니다. 목록 확인 후 다시 진행해주세요.','The server could not confirm the result. Check the list before continuing.'],
 NETWORK_ERROR:['네트워크 연결이 끊겼습니다. 처리 결과를 확인한 뒤 다시 진행해주세요.','The connection failed. Check the result before trying again.'],
};
export class PhotoRequestError extends Error{readonly code:string;readonly status?:number;constructor(code:string,status?:number){super(code);this.code=code;this.status=status;}}
export async function checkedPhotoResponse(response:Response){
 const data=await response.json().catch(()=>null);
 if(!response.ok){const code=data&&typeof data.code==='string'&&Object.hasOwn(messages,data.code)?data.code:response.status===413?'BODY_TOO_LARGE':response.status===401||response.status===403?'ADMIN_REQUIRED':'PHOTO_RESULT_UNCONFIRMED';throw new PhotoRequestError(code,response.status);}
 if(!data)throw new PhotoRequestError('PHOTO_RESULT_UNCONFIRMED',response.status);
 return data;
}
export function photoFailureMessage(error:unknown,english=false):string{
 const code=error instanceof Error?error.message:'';
 if(code==='PHOTO_UPLOAD_INCOMPLETE')return (english?'Upload stopped; this album was not published. ':'업로드 중단으로 앨범을 공개하지 않았습니다. ')+photoFailureMessage(error instanceof Error?error.cause:undefined,english);
 const text=messages[code]?.[english?1:0]??(english?'An unexpected error occurred. Check the result before retrying.':'예상하지 못한 오류입니다. 자동 재시도하지 말고 결과를 확인해주세요.');
 return text+(error instanceof PhotoRequestError&&error.status?` (HTTP ${error.status})`:'');
}

export async function photoFetch(input:RequestInfo|URL,init?:RequestInit){try{return await fetch(input,init);}catch{throw new PhotoRequestError('NETWORK_ERROR');}}
