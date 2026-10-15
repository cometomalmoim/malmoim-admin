// Confirmed operating facts shared by the two landing pages. Intake is enabled only after the DB migration opens recruitment.
export const season9 = {
  slug: "season9", intakeEnabled: true,
  closesAt: "2026-10-31T15:00:00Z",
  thursday: { startsAt: "2026-11-05", time: "18:30–21:00" },
  saturday: { startsAt: "2026-11-07", time: "13:00–15:30" },
  sessions: 6, fee: 50000,
} as const;
export type SeasonLocale = "ko" | "en";
