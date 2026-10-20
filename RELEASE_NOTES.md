# Release notes

## 1.0.0

Initial release of the Transmit Security Identity Orchestration plugin for Cordova (iOS and Android), exposed as `cordova.tsido`.

- **Initialization:** `initializeSDK()` from the platform configuration file, or `initialize(clientId, options)` programmatically.
- **Journeys:** `startJourney`, `startMobileApproveJourney`, `submitClientResponse`, and `generateDebugPin`.
- **Journey events:** steps, instructions and errors arrive through one listener API (`addJourneyResponseListener` / `removeJourneyResponseListener` / `removeAllJourneyResponseListeners`). Events that arrive before the first listener are buffered.
- **Normalized constants:** journey step ids (`STEPS`), response options (`RESPONSE_OPTIONS`) and instruction types (`INSTRUCTIONS`) are the same on both platforms.
- **Push:** `setPushToken`.
- **Logging:** `setLoggingEnabled`.
- **Credential steps:** passkeys, native biometrics, PIN and TOTP steps are completed with the [`cordova-ts-authentication`](https://github.com/TransmitSecurity/cordova_ts_authentication_plugin) plugin.

**Native SDKs:** iOS `IdentityOrchestration` 1.2.5 (Swift Package Manager), Android `com.ts.sdk:identityorchestration` 1.0.36.

**Requirements:** `cordova-ios` ≥ 8.0.0, `cordova-android` ≥ 12.0.0, iOS 13+, Android minSdk 24.
