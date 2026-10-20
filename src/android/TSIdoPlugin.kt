package com.transmitsecurity.ido

import com.transmit.idosdk.TSIdo
import com.transmit.idosdk.TSIdoCallback
import com.transmit.idosdk.TSIdoClientResponseOption
import com.transmit.idosdk.TSIdoClientResponseOptionType
import com.transmit.idosdk.TSIdoEncryptionMode
import com.transmit.idosdk.TSIdoErrorCode
import com.transmit.idosdk.TSIdoInitOptions
import com.transmit.idosdk.TSIdoInstruction
import com.transmit.idosdk.TSIdoSdkError
import com.transmit.idosdk.TSIdoServiceResponse
import com.transmit.idosdk.TSIdoStartJourneyOptions
import com.transmit.idosdk.TSPushTokenType
import org.apache.cordova.CallbackContext
import org.apache.cordova.CordovaPlugin
import org.apache.cordova.PluginResult
import org.json.JSONArray
import org.json.JSONObject

class TSIdoPlugin : CordovaPlugin() {

    companion object {
        private const val DEFAULT_SERVER_PATH = "https://api.transmitsecurity.io"
        private const val MAX_PENDING_EVENTS = 50
    }

    /**
     * The long-lived `journeyResponses` exec. Journey state is pushed by the SDK
     * rather than returned per call, so it all flows through this one channel.
     */
    private var journeyResponsesCallback: CallbackContext? = null

    /**
     * Events produced before JS opens the subscription. A journey started right
     * after init can deliver its first step before the exec lands, and dropping
     * it would strand the flow.
     */
    private val pendingEvents = ArrayDeque<JSONObject>()

    override fun onDestroy() {
        journeyResponsesCallback = null
        pendingEvents.clear()
        super.onDestroy()
    }

    override fun execute(action: String, args: JSONArray, callback: CallbackContext): Boolean {
        when (action) {
            "initializeSDK"             -> initializeSDK(callback)
            "initialize"                -> initialize(args, callback)
            "startJourney"              -> startJourney(args, callback)
            "startMobileApproveJourney" -> startMobileApproveJourney(args, callback)
            "submitClientResponse"      -> submitClientResponse(args, callback)
            "generateDebugPin"          -> generateDebugPin(callback)
            "setLoggingEnabled"         -> setLoggingEnabled(args, callback)
            "setPushToken"              -> setPushToken(args, callback)
            "journeyResponses"          -> journeyResponses(callback)
            else                        -> return false
        }
        return true
    }

    // region SDK setup

    private fun initializeSDK(callback: CallbackContext) {
        // The JS `configurationFile` argument is iOS-only (plist name); Android
        // always reads the transmit_security_* string resources, so it is
        // deliberately ignored here rather than rejected.
        cordova.activity.runOnUiThread {
            try {
                TSIdo.initializeSDK(cordova.activity.applicationContext)
                callback.ok()
            } catch (e: Exception) {
                callback.fail("SDK_INIT_ERROR", e.message ?: e.toString())
            }
        }
    }

    private fun initialize(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: run {
            callback.fail("INVALID_ARGS", "args required"); return
        }
        val clientId = opts.stringOrNull("clientId") ?: run {
            callback.fail("INVALID_ARGS", "clientId is required"); return
        }
        val options = opts.optJSONObject("options")

        cordova.activity.runOnUiThread {
            try {
                val initOptions = TSIdoInitOptions(
                    serverPath = options?.stringOrNull("serverPath") ?: DEFAULT_SERVER_PATH,
                    pollingTimeout = options?.intOrNull("pollingTimeout"),
                    resourceUri = options?.stringOrNull("resource"),
                    locale = options?.stringOrNull("locale"),
                    collectRiskData = options?.optBoolean("collectRiskData", false) ?: false
                )
                TSIdo.initializeSDK(cordova.activity.applicationContext, clientId, initOptions)
                callback.ok()
            } catch (e: Exception) {
                callback.fail("SDK_INIT_ERROR", e.message ?: e.toString())
            }
        }
    }

    private fun setLoggingEnabled(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0)
        if (opts == null || !opts.has("enabled")) {
            callback.fail("INVALID_ARGS", "enabled must be true or false"); return
        }
        val enabled = opts.optBoolean("enabled", false)
        cordova.activity.runOnUiThread {
            TSIdo.setLoggingEnabled(enabled)
            callback.ok()
        }
    }

    private fun setPushToken(args: JSONArray, callback: CallbackContext) {
        val token = args.optJSONObject(0)?.stringOrNull("token") ?: run {
            callback.fail("INVALID_ARGS", "token is required"); return
        }
        cordova.activity.runOnUiThread {
            try {
                TSIdo.setPushToken(token, TSPushTokenType.Fcm)
                callback.ok()
            } catch (e: Exception) {
                callback.fail("SET_PUSH_TOKEN_ERROR", e.message ?: e.toString())
            }
        }
    }

    // endregion

    // region Journeys

    private fun startJourney(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: run {
            callback.fail("INVALID_ARGS", "args required"); return
        }
        val journeyId = opts.stringOrNull("journeyId") ?: run {
            callback.fail("INVALID_ARGS", "journeyId is required"); return
        }
        val startOptions = convertStartJourneyOptions(opts.optJSONObject("options"))

        cordova.activity.runOnUiThread {
            try {
                TSIdo.startJourney(journeyId, startOptions, journeyCallback())
                callback.ok()
            } catch (e: Exception) {
                callback.fail("START_JOURNEY_ERROR", e.message ?: e.toString())
            }
        }
    }

    private fun startMobileApproveJourney(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: run {
            callback.fail("INVALID_ARGS", "args required"); return
        }
        val payloadJson = opts.optJSONObject("payload")
        if (payloadJson == null || payloadJson.length() == 0) {
            callback.fail("INVALID_ARGS", "payload is required"); return
        }
        // The Android SDK takes Map<String, String>; the iOS SDK takes [String: Any].
        // Push payload values arrive as strings anyway, so flatten for parity.
        val payload = payloadJson.toStringValueMap()
        val startOptions = convertStartJourneyOptions(opts.optJSONObject("startJourneyOptions"))

        cordova.activity.runOnUiThread {
            try {
                TSIdo.startMobileApproveJourney(payload, startOptions, journeyCallback())
                callback.ok()
            } catch (e: Exception) {
                callback.fail("START_MOBILE_APPROVE_ERROR", e.message ?: e.toString())
            }
        }
    }

    private fun submitClientResponse(args: JSONArray, callback: CallbackContext) {
        val opts = args.optJSONObject(0) ?: run {
            callback.fail("INVALID_ARGS", "args required"); return
        }
        val rawResponseId = opts.stringOrNull("responseId") ?: run {
            callback.fail("INVALID_ARGS", "responseId is required"); return
        }

        val optionType = convertResponseOptionId(rawResponseId)
        // Custom options are submitted under their own id, not the enum's type.
        val responseType =
            if (optionType == TSIdoClientResponseOptionType.Custom) rawResponseId
            else optionType.type

        val data: Map<String, Any?>? = opts.optJSONObject("data")?.toNestedMap()

        cordova.activity.runOnUiThread {
            try {
                TSIdo.submitClientResponse(responseType, data, journeyCallback())
                callback.ok()
            } catch (e: Exception) {
                callback.fail("SUBMIT_RESPONSE_ERROR", e.message ?: e.toString())
            }
        }
    }

    private fun generateDebugPin(callback: CallbackContext) {
        cordova.activity.runOnUiThread {
            try {
                TSIdo.generateDebugPin(object : TSIdoCallback<String> {
                    override fun idoSuccess(result: String) {
                        callback.success(result)
                    }

                    override fun idoError(error: TSIdoSdkError) {
                        callback.fail("GENERATE_DEBUG_PIN_ERROR", error.errorMessage)
                    }

                    override fun idoInstruction(instruction: TSIdoInstruction) {
                        emitInstruction(instruction)
                    }
                })
            } catch (e: Exception) {
                callback.fail("GENERATE_DEBUG_PIN_ERROR", e.message ?: e.toString())
            }
        }
    }

    // endregion

    // region Journey response subscription

    private fun journeyResponses(callback: CallbackContext) {
        // Assigned on the UI thread, not on Cordova's exec thread: emit() reads
        // this and drains pendingEvents there, so keeping every access on one
        // thread is what makes both safe without locking.
        cordova.activity.runOnUiThread {
            journeyResponsesCallback = callback
            while (pendingEvents.isNotEmpty()) {
                sendEvent(callback, pendingEvents.removeFirst())
            }
        }
    }

    /**
     * One callback shape for every SDK entry point: the request/response pairing
     * lives in the exec promise, journey state goes to the event channel. This
     * matches the iOS delegate, which has no per-call association at all.
     */
    private fun journeyCallback() = object : TSIdoCallback<TSIdoServiceResponse> {
        override fun idoSuccess(result: TSIdoServiceResponse) {
            emitResponse(result)
        }

        override fun idoError(error: TSIdoSdkError) {
            emitError(error)
        }

        override fun idoInstruction(instruction: TSIdoInstruction) {
            emitInstruction(instruction)
        }
    }

    /**
     * The SDK invokes its callbacks on a background thread, so hop to the UI
     * thread before touching `pendingEvents` / `journeyResponsesCallback` —
     * ArrayDeque is not thread-safe and journeyResponses() drains it there.
     */
    private fun emit(event: JSONObject) {
        cordova.activity.runOnUiThread {
            val cb = journeyResponsesCallback
            if (cb == null) {
                if (pendingEvents.size >= MAX_PENDING_EVENTS) pendingEvents.removeFirst()
                pendingEvents.addLast(event)
                return@runOnUiThread
            }
            sendEvent(cb, event)
        }
    }

    /** Must be called on the UI thread. */
    private fun sendEvent(callback: CallbackContext, event: JSONObject) {
        val result = PluginResult(PluginResult.Status.OK, event)
        result.keepCallback = true
        callback.sendPluginResult(result)
    }

    private fun emitResponse(response: TSIdoServiceResponse) {
        val body = JSONObject()

        // `responseData` is the current field; `data` is deprecated as of 1.0.32
        // but is read as a fallback so a step that only populates the old field
        // still reaches JS.
        val responseData = response.responseData
        if (responseData != null && responseData.length() > 0) {
            body.put("data", responseData)
        } else {
            @Suppress("DEPRECATION")
            when (val legacy = response.data) {
                is JSONObject -> body.put("data", legacy)
                is Map<*, *> -> body.put("data", JSONObject(legacy.toStringKeyedMap()))
                null -> {}
                else -> body.put("data", legacy.toString())
            }
        }

        response.journeyStepId?.let { body.put("journeyStepId", it) }
        response.token?.let { body.put("token", it) }

        // iOS 1.2.2 exposes the token-exchange code as TSIdoServiceResponse.code;
        // the Android SDK has no such field yet, so read it off the payload.
        responseData?.stringOrNull("code")?.let { body.put("code", it) }

        response.clientResponseOptions?.let { options ->
            body.put("clientResponseOptions", convertClientResponseOptions(options))
        }

        response.errorData?.let { errorData ->
            body.put("errorData", JSONObject().apply {
                put("code", errorCode(errorData.errorCode))
                put("message", errorData.errorMessage)
            })
        }

        emit(JSONObject().apply {
            put("type", "response")
            put("response", body)
        })
    }

    private fun emitError(error: TSIdoSdkError) {
        emit(JSONObject().apply {
            put("type", "error")
            put("error", JSONObject().apply {
                put("code", errorCode(error.errorCode))
                put("message", error.errorMessage)
            })
        })
    }

    private fun emitInstruction(instruction: TSIdoInstruction) {
        emit(JSONObject().apply {
            put("type", "instruction")
            put("instruction", JSONObject().apply {
                put("type", instruction.type.type)
                put("stepId", instruction.stepId)
                put("data", instruction.data ?: JSONObject())
            })
        })
    }

    // endregion

    // region Argument conversion

    private fun convertStartJourneyOptions(raw: JSONObject?): TSIdoStartJourneyOptions {
        if (raw == null) return TSIdoStartJourneyOptions(null, null, TSIdoEncryptionMode.None)

        // `encrypted` is accepted as an alias so a payload built for the Flutter
        // plugin's startMobileApproveJourney options works unchanged.
        val encrypted = when {
            raw.has("encryptionMode") -> raw.optBoolean("encryptionMode", false)
            raw.has("encrypted") -> raw.optBoolean("encrypted", false)
            else -> false
        }

        // drsSessionToken is iOS-only (TSIdoStartJourneyOptions has no such field
        // in the Android SDK); silently unused here.
        return TSIdoStartJourneyOptions(
            additionalParams = raw.optJSONObject("additionalParams")?.toNestedMap(),
            flowId = raw.stringOrNull("flowId"),
            encryptionMode = if (encrypted) TSIdoEncryptionMode.Full else TSIdoEncryptionMode.None
        )
    }

    private fun convertResponseOptionId(raw: String): TSIdoClientResponseOptionType =
        when (raw) {
            "clientInput" -> TSIdoClientResponseOptionType.ClientInput
            "cancel" -> TSIdoClientResponseOptionType.Cancel
            "fail" -> TSIdoClientResponseOptionType.Fail
            "resend" -> TSIdoClientResponseOptionType.Resend
            else -> TSIdoClientResponseOptionType.Custom
        }

    private fun convertClientResponseOptions(
        options: Map<String, TSIdoClientResponseOption>
    ): JSONObject = JSONObject().apply {
        options.forEach { (key, option) ->
            put(key, JSONObject().apply {
                put("id", option.id)
                put("label", option.label)
                put("type", responseOptionTypeName(option.type))
                option.schema?.let { put("schema", it) }
            })
        }
    }

    /**
     * Emits the same vocabulary that `submitClientResponse` accepts, so an id
     * read off a response can be handed straight back.
     */
    private fun responseOptionTypeName(type: TSIdoClientResponseOptionType): String =
        when (type) {
            TSIdoClientResponseOptionType.ClientInput -> "clientInput"
            TSIdoClientResponseOptionType.Cancel -> "cancel"
            TSIdoClientResponseOptionType.Fail -> "fail"
            TSIdoClientResponseOptionType.Resend -> "resend"
            TSIdoClientResponseOptionType.Custom -> "custom"
        }

    /**
     * Stable, cross-platform error codes: these match the strings the iOS bridge
     * derives from TSIdoJourneyError.
     */
    @Suppress("REDUNDANT_ELSE_IN_WHEN")
    private fun errorCode(code: TSIdoErrorCode?): String = when (code) {
        TSIdoErrorCode.InvalidInitializationOptions -> "invalidInitializationOptions"
        TSIdoErrorCode.NotInitialized -> "notInitialized"
        TSIdoErrorCode.NoActiveJourney -> "noActiveJourney"
        TSIdoErrorCode.NetworkError -> "networkError"
        TSIdoErrorCode.ClientResponseNotValid -> "clientResponseNotValid"
        TSIdoErrorCode.ServerError -> "serverError"
        TSIdoErrorCode.InvalidStateString -> "invalidStateString"
        TSIdoErrorCode.InternalError -> "internalError"
        TSIdoErrorCode.DeviceRegistrationError -> "deviceRegistrationError"
        TSIdoErrorCode.DeviceValidationError -> "deviceValidationError"
        TSIdoErrorCode.InvalidCredentials -> "invalidCredentials"
        TSIdoErrorCode.ExpiredOtpPasscode -> "expiredOTPPasscode"
        TSIdoErrorCode.ExpiredValidationPasscode -> "expiredValidationPasscode"
        TSIdoErrorCode.MaxResendReached -> "maxResendReached"
        // IDV codes, added in 1.0.33–1.0.36. Android only: iOS 1.2.5 has no
        // equivalent cases, so it reports these failures as internalError
        // (documented in UserGuide.md).
        TSIdoErrorCode.IdvCameraPermissionRequired -> "idvCameraPermissionRequired"
        TSIdoErrorCode.IdvSdkDisabled -> "idvSdkDisabled"
        TSIdoErrorCode.IdvSessionNotValid -> "idvSessionNotValid"
        TSIdoErrorCode.IdvInitializationError -> "idvInitializationError"
        TSIdoErrorCode.IdvNotInitialized -> "idvNotInitialized"
        TSIdoErrorCode.IdvCanceled -> "idvCanceled"
        TSIdoErrorCode.IdvInternalError -> "idvInternalError"
        TSIdoErrorCode.IdvNotAvailable -> "idvNotAvailable"
        null -> "internalError"
        // A code added by a later SDK — the counterpart of iOS's `@unknown default`,
        // so a version bump doesn't break the build again.
        else -> "internalError"
    }

    // endregion

    // region Helpers

    private fun CallbackContext.ok() = success(1)

    private fun CallbackContext.fail(code: String, message: String?) {
        error(JSONObject().apply {
            put("code", code)
            put("message", message ?: "")
        })
    }

    private fun JSONObject.stringOrNull(key: String): String? =
        optString(key, "").trim().takeIf { it.isNotEmpty() && !isNull(key) }

    private fun JSONObject.intOrNull(key: String): Int? =
        if (has(key) && !isNull(key)) optInt(key) else null

    private fun JSONObject.toStringValueMap(): Map<String, String> = buildMap {
        keys().forEach { key ->
            val value = opt(key)
            if (value != null && value != JSONObject.NULL) {
                put(key, if (value is String) value else value.toString())
            }
        }
    }

    private fun JSONObject.toNestedMap(): Map<String, Any?> = buildMap {
        keys().forEach { key ->
            put(key, when (val value = opt(key)) {
                is JSONObject -> value.toNestedMap()
                is JSONArray -> value.toNestedList()
                JSONObject.NULL -> null
                else -> value
            })
        }
    }

    private fun JSONArray.toNestedList(): List<Any?> = (0 until length()).map { i ->
        when (val value = opt(i)) {
            is JSONObject -> value.toNestedMap()
            is JSONArray -> value.toNestedList()
            JSONObject.NULL -> null
            else -> value
        }
    }

    private fun Map<*, *>.toStringKeyedMap(): Map<String, Any?> = buildMap {
        this@toStringKeyedMap.forEach { (key, value) ->
            if (key is String) put(key, value)
        }
    }

    // endregion
}
