# Season 9 localized recruitment posters

- Korean /season9 uses the supplied Korean poster; /season9/en uses the supplied English poster. Originals are copied byte-for-byte into public/season9/recruitment-poster-ko.png and recruitment-poster-en.png.
- Desktop: introduction, participation fee, six-session summary and application CTA on the left; full uncropped poster on the right.
- Mobile: introduction and CTA first, then poster. Existing schedule/venue, program and application flow remain intact.
- Clicking the poster opens a centered native dialog. Close, Escape or backdrop returns to the page. The page body is locked while open, restored on close/unmount; the browser restores focus to the trigger.
- Dialog uses a viewport-limited full image without cropping. It is opt-in and never opens automatically.
- This change does not modify application submission, DB, selection, payment, SMS or privacy rules.

Verification: changed-file ESLint, production Webpack build/TypeScript, diff check; browser verification of Korean/English poster selection, desktop/mobile containment and open/close/Escape/focus behavior is recorded after deployment.

## Previous gathering gallery
A dedicated three-photo gallery now follows the first-screen schedule/venue summary on both languages. The original activity-01 is restored alongside activity-02/03, relocated from the lower program section to avoid duplicate photos. Captions and accessible descriptions identify previous gatherings. Desktop uses one row; mobile uses a wide first photo and two smaller photos.

## Applicant-first hierarchy
Start dates, weekly/six-session commitment, fee and venue are grouped in the hero. The separate duplicate schedule strip is removed. A primary application CTA and secondary gallery anchor let visitors apply or explore real photos. Existing full details retain class times and the venue caveat. No conversion improvement is claimed without measurement.
