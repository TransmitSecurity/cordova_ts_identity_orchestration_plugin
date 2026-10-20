# cordova-plugin-identity-orchestration v1.0.0

Production Cordova plugin package for Transmit Security Identity Orchestration (iOS + Android).

## Build info

- Built: 2026-10-20 16:48:13 UTC
- Version: 1.0.0
- Source repo: transmitsecurity-dev/cordova_ts_identity_orchestration
- Source commit: 2a09824 (release/1.0.0)

## Installation

### From git

```bash
cordova plugin add https://github.com/TransmitSecurity/cordova_ts_identity_orchestration_plugin.git
# pinned to a release tag:
cordova plugin add https://github.com/TransmitSecurity/cordova_ts_identity_orchestration_plugin.git#v1.0.0
```

### From a local checkout of this package

```bash
cordova plugin add /path/to/cordova-plugin-identity-orchestration
```

Then configure credentials and call `cordova.tsido.initializeSDK()` or `cordova.tsido.initialize(...)`.
See **UserGuide.md** for platform setup, API reference, and error handling.

## Contents

- JavaScript API under `www/ido-plugin/` (`cordova.tsido`)
- iOS Swift Package (`Package.swift`) resolving IdentityOrchestration from `TransmitSecurity/identityOrchestration-ios-sdk` (`1.2.5`) via SPM
- Android Kotlin bridge + Maven dependency (`src/android/cordova-plugin-identity-orchestration.gradle`)
- Cordova hooks for Kotlin, Gradle wrapper pinning, and SPM-only iOS cleanup

Xcode resolves the native iOS SDK on first build (`File > Packages > Resolve Package Versions` if needed).
