// One registration system. Document versions and optional effective dates are
// metadata; registrationEnabled is the independent technical availability switch.
// Once a bundle has acceptances, retain it and use a new collectionVersion.
export const memberRegistrationRelease = {
 collectionVersion:"signup-v1", termsVersion:"terms-v1", privacyVersion:"privacy-v1",
 termsEffectiveDate:null as string|null, privacyEffectiveDate:null as string|null,
 registrationEnabled:true,
};
