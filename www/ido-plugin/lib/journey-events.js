// Journey response listener registry.
//
// The native SDKs push journey state asynchronously (iOS through TSIdoDelegate,
// Android through the TSIdoCallback passed to every SDK call), so there is no
// request/response pairing to hang a Promise on: startJourney() resolving only
// means "the request was accepted". Every journey step, instruction, and error
// arrives here instead.
//
// A single `journeyResponses` exec with keepCallback=true feeds this module; JS
// fans it out to the listeners registered through
// cordova.tsido.addJourneyResponseListener().
//
// Events that arrive while no listener is registered are buffered and flushed to
// the first listener added. Losing the first response of a journey would strand
// the flow, and app startup ordering (deviceready, framework bootstrap) makes
// that race easy to hit.

var exec = require('cordova/exec');
var logger = require('cordova-plugin-identity-orchestration.tsido-logger');
var steps = require('cordova-plugin-identity-orchestration.tsido-journey-steps');

var MAX_BUFFERED_EVENTS = 50;

var _listeners = [];
var _buffered = [];
var _subscribed = false;

/**
 * Adds the normalized, platform-stable fields on top of the raw native payload.
 * The raw values are kept under *Raw so nothing the SDK reported is lost.
 */
function decorate(event) {
    if (!event || typeof event !== 'object') return event;

    if (event.type === 'response' && event.response) {
        var raw = event.response.journeyStepId;
        event.response.journeyStepIdRaw = raw;
        event.response.journeyStepId = steps.normalize(raw);
        event.journeyStepId = event.response.journeyStepId;
    } else if (event.type === 'instruction' && event.instruction) {
        var rawType = event.instruction.type;
        event.instruction.typeRaw = rawType;
        event.instruction.type = steps.normalizeInstruction(rawType);
    }

    return event;
}

function dispatch(rawEvent) {
    var event = decorate(rawEvent);

    if (_listeners.length === 0) {
        if (_buffered.length >= MAX_BUFFERED_EVENTS) _buffered.shift();
        _buffered.push(event);
        logger.warn(
            'journey event buffered (no listener registered): ' + (event && event.type)
        );
        return;
    }

    deliver(event);
}

function deliver(event) {
    // Copy first: a listener may add or remove listeners while being called.
    var current = _listeners.slice();
    for (var i = 0; i < current.length; i++) {
        try {
            current[i](event);
        } catch (e) {
            logger.error('journey response listener threw: ' + (e && e.message ? e.message : e));
        }
    }
}

function flushBuffered() {
    if (_buffered.length === 0) return;
    var queued = _buffered;
    _buffered = [];
    logger.debug('flushing ' + queued.length + ' buffered journey event(s)');
    for (var i = 0; i < queued.length; i++) {
        deliver(queued[i]);
    }
}

/**
 * Opens the single long-lived native subscription. Idempotent — safe to call
 * from every entry point that could precede the first journey response.
 */
function ensureSubscribed() {
    if (_subscribed) return;
    _subscribed = true;

    exec(
        dispatch,
        function (error) {
            // The native side only errors here if the subscription itself fails;
            // journey errors arrive through dispatch() as { type: 'error' }.
            logger.error(
                'journey response subscription failed: ' + JSON.stringify(error || {})
            );
            _subscribed = false;
        },
        'TSIdoPlugin',
        'journeyResponses',
        []
    );

    logger.debug('journey response subscription opened');
}

function addListener(listener) {
    if (typeof listener !== 'function') {
        throw new TypeError('addJourneyResponseListener requires a function');
    }

    _listeners.push(listener);
    ensureSubscribed();
    flushBuffered();

    var removed = false;
    return {
        remove: function () {
            if (removed) return false;
            removed = true;
            return removeListener(listener);
        },
    };
}

function removeListener(listener) {
    var index = _listeners.indexOf(listener);
    if (index === -1) return false;
    _listeners.splice(index, 1);
    return true;
}

function removeAllListeners() {
    _listeners = [];
}

module.exports = {
    ensureSubscribed: ensureSubscribed,
    addListener: addListener,
    removeListener: removeListener,
    removeAllListeners: removeAllListeners,
};
