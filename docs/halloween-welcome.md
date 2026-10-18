# Halloween welcome and JOIN entrance

- Scope: Korean and English public Halloween application only. No DB or submission changes.
- Flow: application notice enters viewport → optional sound / quiet entrance / skip → 2.4-second reveal → DO YOU WANT TO JOIN US? and age notice → JOIN closes dialog and focuses name input.
- Audio: Windows System.Speech, Microsoft Zira Desktop, pitch -45%, rate -15%; says “Welcome. Do you want to join us?” WAV mono 22050 Hz. Offline 0.8-speed pitch lowering, 130 ms echo at 24%, short fades and peak normalization to 24500. Playback only after explicit sound selection; closing/skipping stops it. Actual perceived tone still requires human listening.
- Reduced-motion preference disables reveal animation. Quiet and skip controls remain available.
- Age notice: birth years 1990–2007 inclusive. Public Halloween birth year is required in the form, server action and DB wrapper (038). Existing responses and administrator test forms are preserved. JOIN does not submit an application.

## Generated visual

Tool: built-in imagegen. Original preserved at C:/Users/박승형/.codex/generated_images/01a13db0-731c-77c2-be96-5a54e414f5e9/exec-f933adde-65eb-4b27-9364-159c7b65f341.png
Repository asset: public/events/halloween-2026/dokkaebi-cinematic-v2.png

Prompt:
Create a cinematic realistic horror portrait asset for an adult Halloween party website. A Korean dokkaebi goblin face emerges from deep black burgundy fog, centered front facing, both curved horns fully visible, weathered cracked charcoal skin, unsettling narrow glowing ember-red eyes, slightly open sinister mouth with subtle fangs. Mature eerie haunted-house atmosphere, dramatic dim crimson rim lighting, rich photographic texture, sophisticated film still, frightening but no gore, no blood, no cute cartoon styling. Square composition with space around the horns, face occupies central 65 percent, background fades to near black at all edges for seamless blending in a dark popup. No text, no logos, no watermark.

## Verification

ESLint for changed components and production Webpack build are checked per PR. Browser checks cover optional playback start, quiet/skip, JOIN to form, age copy and mobile layout. No live application is submitted for this presentation change.

Popup size: up to 680px desktop, viewport minus 32px on mobile, up to 90dvh. SQL 038 rollback checks passed against configured DB without public response inserts; required notice version then applied.

## Raspy goblin and ambience follow-up
Voice regenerated from the same System.Speech text, lowered to 0.68 speed with interpolation, parallel tanh saturation (35% wet), 38 Hz amplitude modulation (20%), and 75/190/310 ms echoes. Normalized peak remains 24500 PCM16. Duration 5.95 seconds.
Original 12-second synthesized drone uses 44/55.5/82 Hz layers and quiet detuned 164.75/174.5 Hz tones, with fades and 22% player volume. No external music recording is used. Voice and ambience start only on explicit sound choice. Quiet mode starts neither; skip, JOIN, Escape and unmount stop both. A mute control is available on the JOIN notice. Human listening is needed to assess the intended raspiness.
