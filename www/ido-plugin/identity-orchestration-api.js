/**
 * cordova.tsido — Transmit Security Identity Orchestration.
 *
 * Every method returns a Promise that settles when the native call is accepted.
 * Journey *state* (steps, instructions, errors) does not come back through those
 * Promises — it is pushed asynchronously by the SDK. Register a listener with
 * addJourneyResponseListener() before starting a journey.
 */
var impl = require('cordova-plugin-identity-orchestration.tsido-bridge');
var journeyEvents = require('cordova-plugin-identity-orchestration.tsido-journey-events');
var steps = require('cordova-plugin-identity-orchestration.tsido-journey-steps');

/**
 * Init from TransmitSecurity.plist (iOS) / string resources (Android).
 * @param {string} [configurationFile] plist basename, iOS only. Defaults to
 *   `TransmitSecurity`. Ignored on Android, which always reads string resources.
 */
function initializeSDK(configurationFile) {
    return impl.initializeSDK(configurationFile);
}

/**
 * Init with an explicit clientId instead of a configuration file.
 * @param {string} clientId
 * @param {Object} [options]
 * @param {string} [options.serverPath] defaults to https://api.transmitsecurity.io
 * @param {string} [options.resource]
 * @param {number} [options.pollingTimeout] seconds
 * @param {string} [options.locale]
 * @param {boolean} [options.collectRiskData]
 */
function initialize(clientId, options) {
    return impl.initialize(clientId, options);
}

/**
 * Starts a journey. Results arrive through the journey response listeners.
 * @param {string} journeyId
 * @param {Object} [options]
 * @param {Object} [options.additionalParams]
 * @param {string} [options.flowId]
 * @param {boolean} [options.encryptionMode] true → full journey encryption
 * @param {string} [options.drsSessionToken] iOS only; ignored on Android
 */
function startJourney(journeyId, options) {
    return impl.startJourney(journeyId, options);
}

/**
 * Starts a mobile-approve journey from a received push payload.
 * @param {Object} payload the push notification data payload
 * @param {Object} [startJourneyOptions] same shape as startJourney options
 */
function startMobileApproveJourney(payload, startJourneyOptions) {
    return impl.startMobileApproveJourney(payload, startJourneyOptions);
}

/**
 * Answers the current journey step.
 * @param {string} responseId one of RESPONSE_OPTIONS, or a custom option id
 *   taken from `response.clientResponseOptions`
 * @param {Object} [data] payload matching that option's schema
 */
function submitClientResponse(responseId, data) {
    return impl.submitClientResponse(responseId, data);
}

/** Resolves with a debug PIN string for journeys paused on a debug break. */
function generateDebugPin() {
    return impl.generateDebugPin();
}

/** Toggles native + JS SDK logging. Off by default. */
function setLoggingEnabled(enabled) {
    return impl.setLoggingEnabled(enabled);
}

/** Registers the push token (APNs on iOS, FCM on Android) for mobile approve. */
function setPushToken(token) {
    return impl.setPushToken(token);
}

/**
 * Subscribes to journey responses. Call this before startJourney().
 *
 * The listener receives one of:
 *   { type: 'response',    response:    { journeyStepId, journeyStepIdRaw, data,
 *                                         clientResponseOptions, token, code, errorData } }
 *   { type: 'instruction', instruction: { type, typeRaw, stepId, data } }
 *   { type: 'error',       error:       { code, message } }
 *
 * @param {function} listener
 * @returns {{remove: function(): boolean}} subscription handle
 */
function addJourneyResponseListener(listener) {
    return journeyEvents.addListener(listener);
}

/** Removes a listener previously passed to addJourneyResponseListener. */
function removeJourneyResponseListener(listener) {
    return journeyEvents.removeListener(listener);
}

/** Removes every journey response listener. */
function removeAllJourneyResponseListeners() {
    return journeyEvents.removeAllListeners();
}

module.exports = {
    initializeSDK: initializeSDK,
    initialize: initialize,
    startJourney: startJourney,
    startMobileApproveJourney: startMobileApproveJourney,
    submitClientResponse: submitClientResponse,
    generateDebugPin: generateDebugPin,
    setLoggingEnabled: setLoggingEnabled,
    setPushToken: setPushToken,
    addJourneyResponseListener: addJourneyResponseListener,
    removeJourneyResponseListener: removeJourneyResponseListener,
    removeAllJourneyResponseListeners: removeAllJourneyResponseListeners,

    /** Normalized journey step ids — see response.journeyStepId. */
    STEPS: steps.STEPS,
    /** Built-in submitClientResponse option ids. */
    RESPONSE_OPTIONS: steps.RESPONSE_OPTIONS,
    /** Instruction types delivered as { type: 'instruction' }. */
    INSTRUCTIONS: steps.INSTRUCTIONS,
};
