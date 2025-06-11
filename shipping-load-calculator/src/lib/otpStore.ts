// src/lib/otpStore.ts
export interface OtpStoreEntry {
  otp: string;
  expiresAt: number;
  // Could add a verified flag here if needed before calculation
  // verified: boolean;
};

// This makes the store truly global for the server instance in dev
declare global {
  var otpStoreGlobal: Record<string, OtpStoreEntry> | undefined;
}

export const otpStore = global.otpStoreGlobal || (global.otpStoreGlobal = {});
