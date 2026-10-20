// swift-tools-version:5.9
import PackageDescription

// Identity Orchestration iOS SDK via Swift Package Manager.
// IdentityOrchestration pulls TSCoreSDK transitively from the SDK package manifest.
let package = Package(
    name: "cordova-plugin-identity-orchestration",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(name: "cordova-plugin-identity-orchestration", targets: ["TSIdoPlugin"])
    ],
    dependencies: [
        .package(name: "cordova-ios", path: "../cordova-ios"),
        .package(url: "https://github.com/TransmitSecurity/identityOrchestration-ios-sdk.git", exact: "1.2.5")
    ],
    targets: [
        .target(
            name: "TSIdoPlugin",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "IdentityOrchestration", package: "identityOrchestration-ios-sdk")
            ],
            path: "src/ios"
        )
    ]
)
