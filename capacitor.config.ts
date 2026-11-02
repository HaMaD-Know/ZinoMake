import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native wrapper for the ZinoMake website (iPhone and iPad).
 * The app shows the same web build (dist/) inside a WKWebView; projects are stored in the
 * app's own IndexedDB on the device.
 */
const config: CapacitorConfig = {
  appId: 'com.zinomake.app',
  appName: 'ZinoMake',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#f6f4ef',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
