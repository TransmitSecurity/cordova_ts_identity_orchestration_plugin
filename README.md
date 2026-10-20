# Cordova TS Identity Orchestration — User Guide

## Overview

`cordova-plugin-identity-orchestration` runs Transmit Security Identity Orchestration journeys from a Cordova app on **iOS and Android**. A journey is a server-driven flow: you start it by id, the SDK reports each step it needs the client to handle, and you answer with `submitClientResponse` until the journey completes or is rejected.

The plugin clobbers **`cordova.tsido`**.

## Requirements

| | |
|---|---|
| Cordova | `cordova-ios` ≥ 8.0.0, `cordova-android` ≥ 12.0.0 (14.0.1+ recommended) |
| iOS | 13.0+, Xcode 16+ (Swift Package Manager must reach GitHub) |
| Android | minSdk 24 (SDK floor is API 21), compileSdk 35 |

## Native SDK versions

| Platform | Dependency | Version |
|----------|-----------|---------|
| iOS | [TransmitSecurity/identityOrchestration-ios-sdk](https://github.com/TransmitSecurity/identityOrchestration-ios-sdk) via SPM | `1.2.5` |
| Android | `com.ts.sdk:identityorchestration` from the Transmit Maven repo | `1.0.36` |

Both are declared by the plugin (`Package.swift`, `src/android/cordova-plugin-identity-orchestration.gradle`) — you do not add them yourself.

## Native SDK documentation

- [Journeys overview](https://developer.transmitsecurity.com/guides/orchestration/how_to_journeys/)
- [iOS SDK quick start](https://developer.transmitsecurity.com/guides/orchestration/quick_start_sdk_ios/)
- [Android SDK quick start](https://developer.transmitsecurity.com/guides/orchestration/quick_start_sdk_android/)

## Installation

```bash
cordova plugin add https://github.com/TransmitSecurity/cordova_ts_identity_orchestration_plugin.git

# Pinned to a release (recommended for production)
cordova plugin add https://github.com/TransmitSecurity/cordova_ts_identity_orchestration_plugin.git#v1.0.0

cordova platform add ios android
cordova prepare ios android
```

### iOS setup

Set the deployment target to 13.0 or higher in `config.xml`:

```xml
<platform name="ios">
    <preference name="deployment-target" value="13.0" />
</platform>
```

Xcode resolves `IdentityOrchestration` (and `TSCoreSDK`) through SPM on the first build. If it does not, use **File → Packages → Resolve Package Versions**.

The plugin is SPM-only and installs an `after_prepare` hook that strips the empty CocoaPods scaffolding cordova-ios always generates. If your app uses other CocoaPods-based plugins, the hook detects that (via a non-empty `pods.json`) and does nothing.

If your journeys use the camera or Face ID, add the usage descriptions yourself — the plugin does not request permissions it cannot know you need:

```xml
<platform name="ios">
    <config-file target="*-Info.plist" parent="NSCameraUsageDescription">
        <string>Used to capture identity documents.</string>
    </config-file>
    <config-file target="*-Info.plist" parent="NSFaceIDUsageDescription">
        <string>Used to authenticate you.</string>
    </config-file>
</platform>
```

### Android setup

Set minSdk in `config.xml`:

```xml
<platform name="android">
    <preference name="android-minSdkVersion" value="24" />
</platform>
```

The plugin adds `INTERNET` and `ACCESS_NETWORK_STATE`, the Transmit Maven repository, and the SDK dependency. Two `after_prepare` hooks keep the build working:

- **`enable-android-kotlin.js`** — cordova-android resets `IS_GRADLE_PLUGIN_KOTLIN_ENABLED` to `false` on every `prepare`, which makes Gradle silently skip the plugin's `.kt` file. The hook re-enables it. Android Studio will index the Kotlin without error even when this is off, so a missing plugin at runtime is the only symptom.
- **`pin-android-gradle-wrapper.js`** — Android Studio may bump the Gradle wrapper to 9.x, which AGP 8.7.x rejects (`Cannot select root node 'debugRuntimeClasspathCopy'`). The hook re-pins it to cordova-android's version.

`android.useAndroidX=true` is required (the SDK pulls `androidx.appcompat` and `com.google.android.material`). cordova-android 14 sets it by default.

## Configuration files

`initializeSDK()` reads credentials from a native config file. `initialize(clientId, options)` takes them in JavaScript instead — use one or the other.

### iOS — `TransmitSecurity.plist`

Ship it as a resource:

```xml
<platform name="ios">
    <resource-file src="resources/ios/TransmitSecurity.plist" target="TransmitSecurity.plist" />
</platform>
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>credentials</key>
    <dict>
        <key>baseUrl</key>
        <string>https://api.transmitsecurity.io/</string>
        <key>clientId</key>
        <string>YOUR_CLIENT_ID</string>
        <key>applicationId</key>
        <string>default_application</string>
    </dict>
</dict>
</plist>
```

### Android — `strings.xml`

```xml
<resources>
    <string name="transmit_security_client_id">YOUR_CLIENT_ID</string>
    <string name="transmit_security_base_url">https://api.transmitsecurity.io/</string>
    <string name="transmit_security_app_id">default_application</string>
</resources>
```

The `configurationFile` argument to `initializeSDK()` is the **iOS plist basename only**. Android ignores it and always reads these string resources.

## Quick start

### 1. Subscribe before you start a journey

This is the part that most often goes wrong. Journey state is **pushed** by the SDK, not returned from `startJourney()`. Register the listener first:

```js
document.addEventListener('deviceready', function () {
    cordova.tsido.addJourneyResponseListener(onJourneyEvent);

    cordova.tsido.setLoggingEnabled(true)
        .then(function () { return cordova.tsido.initializeSDK('TransmitSecurity'); })
        .then(function () { console.log('IDO ready'); })
        .catch(function (e) { console.error('init failed', e); });
}, false);
```

The plugin buffers journey events until your first listener attaches (both natively and in JS), so an event produced during startup is delivered rather than dropped. Do not rely on that as a design — it is a safety net for the startup race, capped at 50 events.

### 2. Initialize

From the native config file:

```js
await cordova.tsido.initializeSDK();                  // default plist name
await cordova.tsido.initializeSDK('TransmitSecurity'); // explicit (iOS only)
```

Or with an explicit client id:

```js
await cordova.tsido.initialize('YOUR_CLIENT_ID', {
    serverPath: 'https://api.transmitsecurity.io',  // default
    resource: undefined,
    pollingTimeout: undefined,   // seconds
    locale: undefined,
    collectRiskData: false,
});
```

### 3. Start a journey

```js
await cordova.tsido.startJourney('my_journey_id', {
    flowId: 'optional-flow-id',
    additionalParams: { tenant: 'acme' },
    encryptionMode: false,           // true → full journey encryption
    drsSessionToken: undefined,      // iOS only; ignored on Android
});
```

The returned Promise resolving means the request was accepted. The first journey step arrives on your listener.

### 4. Handle journey events

```js
function onJourneyEvent(event) {
    switch (event.type) {
        case 'response':    return onStep(event.response);
        case 'instruction': return console.log('instruction', event.instruction.type);
        case 'error':       return console.error(event.error.code, event.error.message);
    }
}

function onStep(response) {
    switch (response.journeyStepId) {
        case cordova.tsido.STEPS.SUCCESS:
            console.log('done', response.token, response.code);
            break;

        case cordova.tsido.STEPS.REJECTION:
            console.log('rejected', response.data);
            break;

        case cordova.tsido.STEPS.INFORMATION:
            showMessage(response.data.title, response.data.text);
            cordova.tsido.submitClientResponse('clientInput', {});
            break;

        case cordova.tsido.STEPS.EMAIL_OTP_AUTHENTICATION:
            promptForOtp(response.clientResponseOptions);
            break;

        default:
            // Render generically from the step's schema — see "Rendering a step
            // from its schema" below.
            renderFromSchema(response);
    }
}
```

`errorData` can be present on an otherwise normal `response` (a wrong OTP, for example). That is a retryable step, not a journey failure — render the step again and surface the message.

### 5. Submit a response

```js
await cordova.tsido.submitClientResponse('clientInput', { passcode: '123456' });
await cordova.tsido.submitClientResponse('cancel');
await cordova.tsido.submitClientResponse('fail');
await cordova.tsido.submitClientResponse('resend');

// Custom option ids come from the response itself:
const option = response.clientResponseOptions.myCustomOption;
await cordova.tsido.submitClientResponse(option.id, { … });
```

## Rendering a step from its schema

Each step publishes the fields it wants in `clientResponseOptions.<option>.schema`, so you can drive most steps generically instead of hand-coding a screen per authenticator:

```js
{
  clientResponseOptions: {
    clientInput: {
      id: 'clientInput',
      label: 'Verify',
      type: 'clientInput',
      schema: [{ name: 'passcode', type: 'string', optional: false }]
    },
    resend: { id: 'resend', label: 'Resend code', type: 'resend' },
    cancel: { id: 'cancel', label: 'Cancel',      type: 'cancel' }
  }
}
```

`type` is always one of `clientInput` / `cancel` / `fail` / `resend` / `custom` — the same vocabulary `submitClientResponse` accepts, on both platforms.

## API reference

Every method returns a Promise. Rejections are `{ code, message }`.

| Method | Resolves with | Notes |
|--------|--------------|-------|
| `initializeSDK(configurationFile?)` | `true` | `configurationFile` is the iOS plist basename; ignored on Android |
| `initialize(clientId, options?)` | `true` | `options`: `serverPath`, `resource`, `pollingTimeout`, `locale`, `collectRiskData` |
| `startJourney(journeyId, options?)` | `true` | `options`: `flowId`, `additionalParams`, `encryptionMode`, `drsSessionToken` (iOS) |
| `startMobileApproveJourney(payload, options?)` | `true` | `payload` is the received push data payload |
| `submitClientResponse(responseId, data?)` | `true` | `responseId`: built-in id or a custom option id |
| `generateDebugPin()` | PIN `string` | For journeys paused on a debug break |
| `setLoggingEnabled(enabled)` | `true` | Also toggles the plugin's JS logging. Off by default |
| `setPushToken(token)` | `true` | APNs on iOS, FCM on Android |
| `addJourneyResponseListener(fn)` | *(sync)* `{ remove() }` | Register before starting a journey |
| `removeJourneyResponseListener(fn)` | *(sync)* `boolean` | |
| `removeAllJourneyResponseListeners()` | *(sync)* | |

### Constants

```js
cordova.tsido.STEPS             // normalized journey step ids
cordova.tsido.RESPONSE_OPTIONS  // { CLIENT_INPUT, CANCEL, FAIL, RESEND }
cordova.tsido.INSTRUCTIONS      // { PIN_CODE_REGISTRATION_COMMIT, PIN_CODE_DELETION_COMMIT }
```

### Journey event shapes

```js
// A journey step (or a terminal success/rejection)
{
  type: 'response',
  journeyStepId: 'emailOTPAuthentication',   // convenience copy
  response: {
    journeyStepId: 'emailOTPAuthentication', // normalized, cross-platform
    journeyStepIdRaw: 'transmit_platform_email_otp_authentication',
    data: { … },                             // free-form step payload
    clientResponseOptions: { … },
    token: '…',                              // on success
    code: '…',                               // token-exchange code, on success
    errorData: { code, message },            // present on retryable step errors
  }
}

// A side-channel instruction (currently PIN commit / deletion only)
{ type: 'instruction', instruction: { type, typeRaw, stepId, data } }

// A journey failure
{ type: 'error', error: { code, message } }
```

### Journey step ids (`cordova.tsido.STEPS`)

`success`, `rejection`, `information`, `debugBreak`, `waitForAnotherDevice`, `drsTriggerAction`, `identityVerification`, `registerDeviceAction`, `validateDeviceAction`, `webAuthnRegistration`, `webAuthnTransactionSigning`, `nativeBiometricsRegistration`, `nativeBiometricsAuthentication`, `nativeBiometricsTransactionSigning`, `deleteMobileBiometrics`, `selfieAcquisition`, `emailOTPAuthentication`, `smsOTPAuthentication`, `genericOTPAuthentication`, `otpValidation`, `emailValidation`, `smsValidation`, `totpRegistration`, `totpSigningTransaction`, `pinCodeRegistration`, `pinCodeAuthentication`, `pinCodeTransactionSigning`, `pinCodeDeletion`, `authentication`

A custom or unrecognized journey action is passed through as its raw identifier rather than dropped, so you can still branch on it.

## Steps that need a second SDK

Identity Orchestration carries the challenge and accepts the result, but it cannot *produce* certain credentials. These steps need the Transmit Authentication (A+) SDK — use the [`cordova-ts-authentication`](https://github.com/TransmitSecurity/cordova_ts_authentication_plugin) plugin — or the Identity Verification / Account Protection plugins:

| Step | Needs |
|------|-------|
| `webAuthnRegistration`, `webAuthnTransactionSigning` | [`cordova-ts-authentication`](https://github.com/TransmitSecurity/cordova_ts_authentication_plugin) (passkeys) |
| `nativeBiometricsRegistration` / `…Authentication` / `…TransactionSigning`, `deleteMobileBiometrics` | [`cordova-ts-authentication`](https://github.com/TransmitSecurity/cordova_ts_authentication_plugin) |
| `totpRegistration`, `totpSigningTransaction` | [`cordova-ts-authentication`](https://github.com/TransmitSecurity/cordova_ts_authentication_plugin) |
| `selfieAcquisition`, `identityVerification` | Identity Verification SDK |
| `drsTriggerAction` | [`cordova-plugin-drs`](https://github.com/TransmitSecurity/cordova_ts_account_protection_plugin) (Account Protection) |

Reaching one of these without the corresponding SDK leaves the journey stuck on that step. Answer with `fail` so the journey can take its failure branch:

```js
await cordova.tsido.submitClientResponse('fail');
```

Everything else — OTP, PIN code, device registration/validation, information, rejection, debug break, cross-device wait — needs only this plugin.

## Push and mobile approve

```js
await cordova.tsido.setPushToken(token);   // APNs token on iOS, FCM token on Android

// When a mobile-approve push arrives, hand its data payload straight over:
await cordova.tsido.startMobileApproveJourney(pushData, { flowId: 'optional' });
```

Delivering the token and the notification is your app's job (this plugin does not register for push). On Android the SDK takes a `Map<String, String>`, so non-string payload values are stringified; on iOS the payload is passed through as-is.

If `payload` has no request id, the journey fails with `missingRequestIdInApprovalPayload`.

## Error handling

Promise rejections carry a plugin-level code:

| Code | Cause |
|------|-------|
| `INVALID_ARGS` | A required argument was missing or empty |
| `SDK_INIT_ERROR` | `initializeSDK` / `initialize` failed (bad or missing credentials) |
| `START_JOURNEY_ERROR` | The SDK rejected `startJourney` synchronously |
| `START_MOBILE_APPROVE_ERROR` | The SDK rejected `startMobileApproveJourney` |
| `SUBMIT_RESPONSE_ERROR` | The SDK rejected `submitClientResponse` |
| `GENERATE_DEBUG_PIN_ERROR` | `generateDebugPin` failed |
| `SET_PUSH_TOKEN_ERROR` | `setPushToken` failed |

Journey-level failures arrive as `{ type: 'error', error: { code, message } }` with a code from the SDK, normalized to the same string on both platforms:

`notInitialized`, `noActiveJourney`, `networkError`, `clientResponseNotValid`, `serverError`, `invalidInitializationOptions`, `invalidStateString`, `internalError`, `deviceRegistrationError`, `deviceValidationError`, `invalidCredentials`, `expiredOTPPasscode`, `expiredValidationPasscode`, `maxResendReached`, `missingRequestIdInApprovalPayload`

**Android only:** the Android SDK also reports IDV failures through the journey error — `idvCameraPermissionRequired`, `idvSdkDisabled`, `idvSessionNotValid`, `idvInitializationError`, `idvNotInitialized`, `idvCanceled`, `idvInternalError`, `idvNotAvailable`. The iOS SDK (1.2.5) has no equivalent cases, so the same failure arrives there as `internalError`. Treat any unrecognized code as `internalError`.

```js
try {
    await cordova.tsido.startJourney(journeyId);
} catch (e) {
    // Argument / synchronous failures only.
    console.error(e.code, e.message);
}
// Everything asynchronous — including network and server errors — arrives on
// the journey response listener.
```

## Logging

Off by default, matching the native SDKs:

```js
await cordova.tsido.setLoggingEnabled(true);
```

This sets the native log level to debug and enables the plugin's JS logging. JS output is prefixed `TSIdo:` and goes through a single-string `console.log` — on iOS, WKWebView only bridges `console.log` to the Xcode console, and only reliably with one string argument.

## Troubleshooting

| Symptom | Cause |
|---------|-------|
| `cordova.tsido` is undefined | Called before `deviceready`, or `cordova prepare` was not re-run |
| Journey starts but no step ever arrives | No listener registered — see [step 1](#1-subscribe-before-you-start-a-journey) |
| `notInitialized` | `initializeSDK` / `initialize` never resolved successfully |
| Android: plugin not found at runtime | Kotlin compilation was disabled — re-run `cordova prepare` so `enable-android-kotlin.js` runs |
| Android: `Cannot select root node 'debugRuntimeClasspathCopy'` | Gradle wrapper was bumped past 8.13 — re-run `cordova prepare` |
| iOS: `no such module 'IdentityOrchestration'` | SPM has not resolved — File → Packages → Resolve Package Versions, then Clean Build Folder |
| iOS: stale errors after an SDK bump | Product → Clean Build Folder (⇧⌘K), then File → Packages → Reset Package Caches |
| A step renders but never advances | The step needs a second SDK — see [Steps that need a second SDK](#steps-that-need-a-second-sdk) |
