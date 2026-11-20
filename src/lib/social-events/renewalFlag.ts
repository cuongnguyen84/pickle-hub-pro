// Explicit build-time rollout gate. No local-storage/query override or default-on.
export function registrationRenewalEnabled(): boolean {
  return import.meta.env.VITE_REGISTRATION_RENEWAL_ENABLED === "true";
}
