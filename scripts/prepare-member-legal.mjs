// Prepare document candidates only. Approval flags remain in release configuration.
import {writeFileSync} from "node:fs";
import {prepareMemberSignupArtifacts} from "./member-signup-policy.mjs";
writeFileSync("src/lib/member-legal-documents.ts",prepareMemberSignupArtifacts().documentSource);
