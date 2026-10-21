import "server-only";
import type {RegistrationPolicy} from "./member-registration";

// Deliberately closed. DB review + approved privacy text/consent persistence +
// verified Auth password/redirect configuration are prerequisites to enabling signup.
// Do not replace this with a browser-controlled flag or merely an environment toggle.
export const memberRegistrationPolicy:RegistrationPolicy|null = null;
