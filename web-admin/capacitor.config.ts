import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.of1solutions.firmador',
  appName: 'OF1 Firmador',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
