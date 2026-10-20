var exec = require('cordova/exec');
var logger = require('cordova-plugin-identity-orchestration.tsido-logger');
var journeyEvents = require('cordova-plugin-identity-orchestration.tsido-journey-events');
var steps = require('cordova-plugin-identity-orchestration.tsido-journey-steps');

function call(method, args) {
    args = args || [];
    return new Promise(function (resolve, reject) {
        exec(resolve, reject, 'TSIdoPlugin', method, args);
    });
}

/**
 * Opens the journey response subscription as soon as the SDK is initialized, so
 * a response cannot be dropped between init and the app registering a listener
 * (journey-events buffers until then).
 */
function afterInit(promise) {
    return promise.then(function (result) {
        journeyEvents.ensureSubscribed();
        return result;
    });
}

module.exports = {
    initializeSDK: function (configurationFile) {
        return afterInit(call('initializeSDK', [{
            configurationFile: configurationFile || null,
        }]));
    },
    initialize: function (clientId, options) {
        return afterInit(call('initialize', [{
            clientId: clientId,
            options: options || null,
        }]));
    },
    startJourney: function (journeyId, options) {
        return call('startJourney', [{
            journeyId: journeyId,
            options: options || null,
        }]);
    },
    startMobileApproveJourney: function (payload, startJourneyOptions) {
        return call('startMobileApproveJourney', [{
            payload: payload || null,
            startJourneyOptions: startJourneyOptions || null,
        }]);
    },
    submitClientResponse: function (responseId, data) {
        return call('submitClientResponse', [{
            // Accepts either the canonical type ('clientInput') or the server's
            // id spelling ('client_input') for the four built-in options.
            responseId: steps.normalizeResponseOptionId(responseId),
            data: data || null,
        }]);
    },
    generateDebugPin: function () {
        return call('generateDebugPin');
    },
    setLoggingEnabled: function (enabled) {
        logger.setEnabled(!!enabled);
        return call('setLoggingEnabled', [{ enabled: !!enabled }]);
    },
    setPushToken: function (token) {
        return call('setPushToken', [{ token: token }]);
    },
};
