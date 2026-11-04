import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

export const nativeBiometrics = {
  isAvailable: async (): Promise<boolean> => {
    try {
      const res = await BiometricAuth.checkBiometry();
      return res.isAvailable;
    } catch {
      return false;
    }
  },

  authenticate: async (reason = 'Confirm your identity'): Promise<boolean> => {
    try {
      await BiometricAuth.authenticate({
        reason,
        cancelTitle: 'Cancel',
        allowDeviceCredential: true,
      });
      return true;
    } catch {
      return false;
    }
  },
};

