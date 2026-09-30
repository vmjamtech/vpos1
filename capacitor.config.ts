import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.vmjamtech.posandroid',
  appName: 'V-POS',
  webDir: 'www',
  android: {
    // The iMin printer bridge uses ws://127.0.0.1; network policy restricts cleartext to loopback.
    allowMixedContent: true,
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Body,
    },
    LiveUpdate: {
      appId: '54bfa500-4705-4b88-bd40-0c02a2fc472c',
    },
  },
};

export default config;
