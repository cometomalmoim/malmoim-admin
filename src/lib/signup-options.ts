// Country values use ISO 3166-1 alpha-2 codes; labels are produced in Korean.
export const COUNTRY_CODES = ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");

export function getCountryOptions() {
  const names = new Intl.DisplayNames(["ko"], { type: "region" });
  const sorter = new Intl.Collator("ko");
  return COUNTRY_CODES.map(code => ({ code, label: names.of(code) ?? code }))
    .sort((a, b) => a.code === "KR" ? -1 : b.code === "KR" ? 1 : sorter.compare(a.label, b.label));
}

export const CALLING_CODES = [
  ["82", "대한민국"], ["1", "미국·캐나다 등"], ["81", "일본"], ["86", "중국"],
  ["886", "대만"], ["852", "홍콩"], ["853", "마카오"], ["44", "영국"],
  ["33", "프랑스"], ["49", "독일"], ["34", "스페인"], ["39", "이탈리아"],
  ["31", "네덜란드"], ["41", "스위스"], ["46", "스웨덴"], ["47", "노르웨이"],
  ["45", "덴마크"], ["358", "핀란드"], ["48", "폴란드"], ["351", "포르투갈"],
  ["61", "호주"], ["64", "뉴질랜드"], ["84", "베트남"], ["66", "태국"],
  ["63", "필리핀"], ["62", "인도네시아"], ["60", "말레이시아"], ["65", "싱가포르"],
  ["91", "인도"], ["92", "파키스탄"], ["880", "방글라데시"], ["977", "네팔"],
  ["976", "몽골"], ["7", "러시아·카자흐스탄"], ["998", "우즈베키스탄"],
  ["90", "튀르키예"], ["966", "사우디아라비아"], ["971", "아랍에미리트"],
  ["20", "이집트"], ["27", "남아프리카공화국"], ["234", "나이지리아"],
  ["55", "브라질"], ["52", "멕시코"], ["54", "아르헨티나"], ["56", "칠레"],
] as const;

export const KOREAN_LANGUAGE_LEVELS = [
  { value: "none", label: "전혀 못함" },
  { value: "basic", label: "조금 가능" },
  { value: "conversational", label: "일상 회화 가능" },
  { value: "fluent", label: "유창함" },
  { value: "native", label: "네이티브" },
] as const;

// Foreign-language registration starts at basic; stored legacy values are not migrated.
export const FOREIGN_LANGUAGE_LEVELS = KOREAN_LANGUAGE_LEVELS.filter(option => option.value !== "none");

export const FOREIGN_LANGUAGES = [
  ["en", "영어"], ["ja", "일본어"], ["zh", "중국어"], ["es", "스페인어"],
  ["fr", "프랑스어"], ["de", "독일어"], ["it", "이탈리아어"], ["pt", "포르투갈어"],
  ["ru", "러시아어"], ["ar", "아랍어"], ["vi", "베트남어"], ["th", "태국어"],
  ["id", "인도네시아어"], ["ms", "말레이어"], ["tl", "타갈로그어"], ["hi", "힌디어"],
  ["bn", "벵골어"], ["ur", "우르두어"], ["ne", "네팔어"], ["mn", "몽골어"],
  ["uz", "우즈베크어"], ["tr", "튀르키예어"], ["uk", "우크라이나어"], ["pl", "폴란드어"],
  ["nl", "네덜란드어"], ["sv", "스웨덴어"], ["fi", "핀란드어"], ["da", "덴마크어"],
  ["no", "노르웨이어"], ["el", "그리스어"], ["he", "히브리어"], ["fa", "페르시아어"],
  ["sw", "스와힐리어"], ["my", "미얀마어"], ["km", "크메르어"], ["lo", "라오어"],
] as const;

export const GENDERS = [
  { value: "female", label: "여" }, { value: "male", label: "남" },
  { value: "undisclosed", label: "답변하지 않음" },
] as const;

export const SIGNUP_RULES = {
  minForeignLanguages: 1,
  maxForeignLanguages: 5,
  // Provisional UI baseline; compare with the actual Supabase policy before enabling signup.
  minPasswordLength: 8,
  maxPasswordLength: 128,
} as const;

export function getTodayInKorea() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)?.value).join("-");
}
