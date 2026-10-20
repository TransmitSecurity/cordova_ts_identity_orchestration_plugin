import Foundation
import UIKit
import Cordova
import IdentityOrchestration

@objc(TSIdoPlugin)
public class TSIdoPlugin: CDVPlugin, TSIdoDelegate {

    /// Callback id of the long-lived `journeyResponses` exec. Journey state is
    /// pushed by the SDK rather than returned per call, so it all flows through
    /// this one keepCallback channel.
    private var journeyResponsesCallbackId: String?

    /// Events the SDK delivers before JS opens the subscription. The delegate is
    /// installed at init time, so a journey started immediately after init can
    /// produce a response before the `journeyResponses` exec lands.
    private var pendingEvents: [[String: Any]] = []
    private static let maxPendingEvents = 50

    // MARK: - Lifecycle

    public override func dispose() {
        TSIdo.delegate = nil
        journeyResponsesCallbackId = nil
        pendingEvents.removeAll()
        super.dispose()
    }

    // MARK: - SDK setup

    @objc func initializeSDK(_ command: CDVInvokedUrlCommand) {
        let args = command.arguments.first as? [String: Any]
        let configurationFile = (args?["configurationFile"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        DispatchQueue.main.async {
            do {
                if let configurationFile, !configurationFile.isEmpty {
                    try TSIdo.initializeSDK(
                        configuration: TSIdoConfiguration(configurationFileName: configurationFile)
                    )
                } else {
                    try TSIdo.initializeSDK()
                }
                TSIdo.delegate = self
                self.sendOk(command, true)
            } catch {
                self.sendError(command, code: "SDK_INIT_ERROR", message: Self.describe(error))
            }
        }
    }

    @objc func initialize(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let clientId = (args["clientId"] as? String)?
                  .trimmingCharacters(in: .whitespacesAndNewlines),
              !clientId.isEmpty else {
            sendError(command, code: "INVALID_ARGS", message: "clientId is required")
            return
        }

        let options = args["options"] as? [String: Any]

        DispatchQueue.main.async {
            let initOptions = TSIdoInitJourneyOptions(
                serverPath: options?["serverPath"] as? String ?? "https://api.transmitsecurity.io",
                resource: options?["resource"] as? String,
                pollingTimeout: Self.intValue(options?["pollingTimeout"]),
                locale: options?["locale"] as? String,
                collectRiskData: Self.boolValue(options?["collectRiskData"]) ?? false
            )

            do {
                try TSIdo.initialize(clientId: clientId, options: initOptions)
                TSIdo.delegate = self
                self.sendOk(command, true)
            } catch {
                self.sendError(command, code: "SDK_INIT_ERROR", message: Self.describe(error))
            }
        }
    }

    @objc func setLoggingEnabled(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let enabled = Self.boolValue(args["enabled"]) else {
            sendError(command, code: "INVALID_ARGS", message: "enabled must be true or false")
            return
        }
        DispatchQueue.main.async {
            TSIdo.setLogLevel(enabled ? .debug : .off)
            self.sendOk(command, true)
        }
    }

    @objc func setPushToken(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let token = (args["token"] as? String)?
                  .trimmingCharacters(in: .whitespacesAndNewlines),
              !token.isEmpty else {
            sendError(command, code: "INVALID_ARGS", message: "token is required")
            return
        }
        DispatchQueue.main.async {
            do {
                try TSIdo.setPushToken(token)
                self.sendOk(command, true)
            } catch {
                self.sendError(command, code: "SET_PUSH_TOKEN_ERROR", message: Self.describe(error))
            }
        }
    }

    // MARK: - Journeys

    @objc func startJourney(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let journeyId = (args["journeyId"] as? String)?
                  .trimmingCharacters(in: .whitespacesAndNewlines),
              !journeyId.isEmpty else {
            sendError(command, code: "INVALID_ARGS", message: "journeyId is required")
            return
        }

        let options = Self.convertStartJourneyOptions(args["options"] as? [String: Any])

        DispatchQueue.main.async {
            do {
                try TSIdo.startJourney(journeyId: journeyId, options: options)
                self.sendOk(command, true)
            } catch {
                self.sendError(command, code: "START_JOURNEY_ERROR", message: Self.describe(error))
            }
        }
    }

    @objc func startMobileApproveJourney(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let payload = args["payload"] as? [String: Any], !payload.isEmpty else {
            sendError(command, code: "INVALID_ARGS", message: "payload is required")
            return
        }

        let options = Self.convertStartJourneyOptions(args["startJourneyOptions"] as? [String: Any])

        DispatchQueue.main.async {
            do {
                try TSIdo.startMobileApproveJourney(payload: payload, options: options)
                self.sendOk(command, true)
            } catch {
                self.sendError(
                    command,
                    code: "START_MOBILE_APPROVE_ERROR",
                    message: Self.describe(error)
                )
            }
        }
    }

    @objc func submitClientResponse(_ command: CDVInvokedUrlCommand) {
        guard let args = command.arguments.first as? [String: Any],
              let responseId = (args["responseId"] as? String)?
                  .trimmingCharacters(in: .whitespacesAndNewlines),
              !responseId.isEmpty else {
            sendError(command, code: "INVALID_ARGS", message: "responseId is required")
            return
        }

        let data = args["data"] as? [String: Any]

        DispatchQueue.main.async {
            do {
                try TSIdo.submitClientResponse(
                    clientResponseOptionId: Self.convertResponseOptionId(responseId),
                    data: data
                ) { [weak self] instruction in
                    self?.emitInstruction(instruction)
                }
                self.sendOk(command, true)
            } catch {
                self.sendError(
                    command,
                    code: "SUBMIT_RESPONSE_ERROR",
                    message: Self.describe(error)
                )
            }
        }
    }

    @objc func generateDebugPin(_ command: CDVInvokedUrlCommand) {
        DispatchQueue.main.async {
            do {
                try TSIdo.generateDebugPin { pinResult in
                    DispatchQueue.main.async {
                        switch pinResult {
                        case .success(let pin):
                            self.sendOk(command, pin)
                        case .failure(let error):
                            self.sendError(
                                command,
                                code: "GENERATE_DEBUG_PIN_ERROR",
                                message: Self.describe(error)
                            )
                        }
                    }
                }
            } catch {
                self.sendError(
                    command,
                    code: "GENERATE_DEBUG_PIN_ERROR",
                    message: Self.describe(error)
                )
            }
        }
    }

    // MARK: - Journey response subscription

    @objc func journeyResponses(_ command: CDVInvokedUrlCommand) {
        // Cordova runs plugin methods off the main queue, but emit() and the
        // pendingEvents buffer live on it — assign there so the flush cannot
        // interleave with an incoming delegate callback.
        DispatchQueue.main.async {
            self.journeyResponsesCallbackId = command.callbackId
            let queued = self.pendingEvents
            self.pendingEvents.removeAll()
            for event in queued {
                self.emit(event)
            }
        }
    }

    private func emit(_ event: [String: Any]) {
        guard let callbackId = journeyResponsesCallbackId else {
            if pendingEvents.count >= Self.maxPendingEvents { pendingEvents.removeFirst() }
            pendingEvents.append(event)
            return
        }
        let result = CDVPluginResult(status: .ok, messageAs: Self.pluginDictionary(event))
        result.setKeepCallbackAs(true)
        commandDelegate.send(result, callbackId: callbackId)
    }

    private func emitInstruction(_ instruction: TSIdoInstruction) {
        DispatchQueue.main.async {
            self.emit([
                "type": "instruction",
                "instruction": [
                    "type": instruction.type.rawValue,
                    "stepId": instruction.stepId,
                    "data": Self.jsonSafe(instruction.data),
                ] as [String: Any],
            ])
        }
    }

    // MARK: - TSIdoDelegate

    public func TSIdoDidReceiveResult(
        _ result: Result<any TSIdoServiceResponse, TSIdoJourneyError>
    ) {
        switch result {
        case .success(let serviceResponse):
            var response: [String: Any] = [:]

            if let data = serviceResponse.data {
                response["data"] = Self.jsonSafe(data)
            }
            if let journeyStepId = serviceResponse.journeyStepId {
                response["journeyStepId"] = journeyStepId.rawValue
            }
            if let options = serviceResponse.clientResponseOptions {
                response["clientResponseOptions"] = Self.convertClientResponseOptions(options)
            }
            if let token = serviceResponse.token {
                response["token"] = token
            }
            if let code = serviceResponse.code {
                response["code"] = code
            }
            if let errorData = serviceResponse.errorData {
                response["errorData"] = [
                    "code": Self.errorCode(errorData.errorCode),
                    "message": errorData.description,
                ]
            }

            DispatchQueue.main.async {
                self.emit(["type": "response", "response": response])
            }

        case .failure(let error):
            DispatchQueue.main.async {
                self.emit([
                    "type": "error",
                    "error": [
                        "code": Self.errorCode(error),
                        "message": Self.describe(error),
                    ] as [String: Any],
                ])
            }
        }
    }

    // MARK: - Argument conversion

    private static func convertStartJourneyOptions(
        _ raw: [String: Any]?
    ) -> TSIdoStartJourneyOptions? {
        guard let raw else { return nil }
        // `encrypted` is accepted as an alias so a payload built for the Flutter
        // plugin's startMobileApproveJourney options works unchanged.
        let encrypted = boolValue(raw["encryptionMode"]) ?? boolValue(raw["encrypted"]) ?? false
        return TSIdoStartJourneyOptions(
            additionalParams: raw["additionalParams"] as? [String: Any],
            flowId: raw["flowId"] as? String,
            drsSessionToken: raw["drsSessionToken"] as? String,
            encryptionMode: encrypted ? .full : .none
        )
    }

    private static func convertResponseOptionId(
        _ rawResponseOptionId: String
    ) -> TSIdoClientResponseOptionType {
        switch rawResponseOptionId {
        case "clientInput": return .clientInput
        case "cancel": return .cancel
        case "fail": return .fail
        case "resend": return .resend
        default: return .custom(id: rawResponseOptionId)
        }
    }

    private static func convertClientResponseOptions(
        _ options: [String: any TSIdoClientResponseOption]
    ) -> [String: Any] {
        var converted: [String: Any] = [:]
        for (key, option) in options {
            var dict: [String: Any] = [
                "id": option.id,
                "label": option.label,
                "type": responseOptionTypeName(option.type),
            ]
            if let schema = option.schema {
                dict["schema"] = jsonSafe(schema)
            }
            converted[key] = dict
        }
        return converted
    }

    /// Emits the same vocabulary that `submitClientResponse` accepts, so an id
    /// read off a response can be handed straight back.
    private static func responseOptionTypeName(
        _ type: TSIdoClientResponseOptionType
    ) -> String {
        switch type {
        case .clientInput: return "clientInput"
        case .cancel: return "cancel"
        case .fail: return "fail"
        case .resend: return "resend"
        case .custom: return "custom"
        // The SDK enums ship with library evolution enabled, so a newer SDK can
        // add cases without a recompile here.
        @unknown default: return "custom"
        }
    }

    /// Stable, cross-platform error codes: these match the strings the Android
    /// bridge derives from `TSIdoErrorCode`.
    private static func errorCode(_ error: TSIdoJourneyError) -> String {
        switch error {
        case .notInitialized: return "notInitialized"
        case .noActiveJourney: return "noActiveJourney"
        case .networkError: return "networkError"
        case .clientResponseNotValid: return "clientResponseNotValid"
        case .serverError: return "serverError"
        case .initializationError: return "invalidInitializationOptions"
        case .invalidCredentials: return "invalidCredentials"
        case .expiredOTPPasscode: return "expiredOTPPasscode"
        case .maxResendReached: return "maxResendReached"
        case .missingRequestIdInApprovalPayload: return "missingRequestIdInApprovalPayload"
        case .internalError: return "internalError"
        @unknown default: return "internalError"
        }
    }

    private static func describe(_ error: Error) -> String {
        if let journeyError = error as? TSIdoJourneyError {
            switch journeyError {
            case .serverError(let underlying):
                guard let underlying else { return "serverError" }
                return "serverError: \(underlying.localizedDescription)"
            default:
                return String(describing: journeyError)
            }
        }
        if let sdkError = error as? TSIdoSdkError {
            return sdkError.description
        }
        return error.localizedDescription
    }

    private static func boolValue(_ value: Any?) -> Bool? {
        if let value = value as? Bool { return value }
        if let value = value as? NSNumber { return value.boolValue }
        return nil
    }

    private static func intValue(_ value: Any?) -> Int? {
        if let value = value as? Int { return value }
        if let value = value as? NSNumber { return value.intValue }
        return nil
    }

    // MARK: - Cordova plugin result helpers

    /// Recursively strips anything the Cordova JSON bridge cannot serialize.
    /// Journey `data` is free-form server JSON, so an unexpected type here would
    /// otherwise drop the whole payload.
    private static func jsonSafe(_ value: Any) -> Any {
        switch value {
        case is NSNull:
            return NSNull()
        case let string as String:
            return string
        case let number as NSNumber:
            return number
        case let dict as [String: Any]:
            return dict.mapValues { jsonSafe($0) }
        case let array as [Any]:
            return array.map { jsonSafe($0) }
        case let dict as NSDictionary:
            var result: [String: Any] = [:]
            dict.forEach { key, val in
                if let key = key as? String { result[key] = jsonSafe(val) }
            }
            return result
        case let array as NSArray:
            return array.map { jsonSafe($0) }
        default:
            return String(describing: value)
        }
    }

    private static func pluginDictionary(_ dict: [String: Any]) -> [AnyHashable: Any] {
        Dictionary(uniqueKeysWithValues: dict.map { (AnyHashable($0.key), jsonSafe($0.value)) })
    }

    private func sendOk(_ command: CDVInvokedUrlCommand, _ message: Bool) {
        commandDelegate.send(
            CDVPluginResult(status: .ok, messageAs: message),
            callbackId: command.callbackId
        )
    }

    private func sendOk(_ command: CDVInvokedUrlCommand, _ message: String) {
        commandDelegate.send(
            CDVPluginResult(status: .ok, messageAs: message),
            callbackId: command.callbackId
        )
    }

    private func sendError(_ command: CDVInvokedUrlCommand, code: String, message: String) {
        commandDelegate.send(
            CDVPluginResult(
                status: .error,
                messageAs: Self.pluginDictionary(["code": code, "message": message])
            ),
            callbackId: command.callbackId
        )
    }
}
