import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hoopr.app',
  appName: 'Hoopr',
  webDir: 'dist',
  backgroundColor: '#f8f9f3',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    CapacitorCookies: { enabled: true },
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#f8f9f3',
    },
  },
};

export default config;
