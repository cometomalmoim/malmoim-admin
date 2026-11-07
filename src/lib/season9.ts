// Confirmed operating facts shared by the two landing pages. Intake is enabled only after the DB migration opens recruitment.
export const season9 = {
  slug: "season9", intakeEnabled: true,
  closesAt: "2026-10-31T15:00:00Z",
  thursday: { startsAt: "2026-11-12", time: "18:30–21:00" },
  saturday: { startsAt: "2026-11-14", time: "13:00–15:30" },
  sessions: 7, fee: 50000,
} as const;
export type SeasonLocale = "ko" | "en";

export const season9ScheduleNotice={
 ko:'이번 9기는 시작 일정이 한 주 연기되어 목요일반은 11월 12일, 토요일반은 11월 14일에 시작합니다. 이번 기수는 특별히 주 1회, 총 7회로 진행됩니다.',
 en:'Season 9 will start one week later: Thursday, November 12, and Saturday, November 14. For this season, the program has been extended to seven weekly sessions.',
} as const;
