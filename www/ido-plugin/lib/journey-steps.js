// Journey step (action type) constants and cross-platform normalization.
//
// The two native SDKs report the current journey step differently:
//
//   Android  TSIdoServiceResponse.journeyStepId is a raw String from the server
//            ("action:information", "transmit_platform_email_otp_authentication", …)
//   iOS      TSIdoServiceResponse.journeyStepId is a TSIdoJourneyActionType enum;
//            the plugin forwards its rawValue, which uses the same conventions —
//            except for a few cases where the SDKs disagree
//            (iOS "action:journey" vs Android "action:success", iOS
//            "action:wait_for_ticket" vs Android "action:wait_for_another_device").
//
// Normalizing in JS rather than in Swift + Kotlin keeps one table instead of two
// that can drift. `normalize()` accepts a raw server string, an iOS camelCase
// case name, or an Android PascalCase enum name and always returns one of the
// STEPS values below (or the input unchanged for a custom/unknown step).

var STEPS = {
    SUCCESS: 'success',
    REJECTION: 'rejection',
    INFORMATION: 'information',
    DEBUG_BREAK: 'debugBreak',
    WAIT_FOR_ANOTHER_DEVICE: 'waitForAnotherDevice',
    DRS_TRIGGER_ACTION: 'drsTriggerAction',
    IDENTITY_VERIFICATION: 'identityVerification',
    REGISTER_DEVICE_ACTION: 'registerDeviceAction',
    VALIDATE_DEVICE_ACTION: 'validateDeviceAction',
    WEB_AUTHN_REGISTRATION: 'webAuthnRegistration',
    WEB_AUTHN_TRANSACTION_SIGNING: 'webAuthnTransactionSigning',
    NATIVE_BIOMETRICS_REGISTRATION: 'nativeBiometricsRegistration',
    NATIVE_BIOMETRICS_AUTHENTICATION: 'nativeBiometricsAuthentication',
    NATIVE_BIOMETRICS_TRANSACTION_SIGNING: 'nativeBiometricsTransactionSigning',
    DELETE_MOBILE_BIOMETRICS: 'deleteMobileBiometrics',
    SELFIE_ACQUISITION: 'selfieAcquisition',
    EMAIL_OTP_AUTHENTICATION: 'emailOTPAuthentication',
    SMS_OTP_AUTHENTICATION: 'smsOTPAuthentication',
    GENERIC_OTP_AUTHENTICATION: 'genericOTPAuthentication',
    OTP_VALIDATION: 'otpValidation',
    EMAIL_VALIDATION: 'emailValidation',
    SMS_VALIDATION: 'smsValidation',
    TOTP_REGISTRATION: 'totpRegistration',
    TOTP_SIGNING_TRANSACTION: 'totpSigningTransaction',
    PIN_CODE_REGISTRATION: 'pinCodeRegistration',
    PIN_CODE_AUTHENTICATION: 'pinCodeAuthentication',
    PIN_CODE_TRANSACTION_SIGNING: 'pinCodeTransactionSigning',
    PIN_CODE_DELETION: 'pinCodeDeletion',
    AUTHENTICATION: 'authentication',
};

// Raw SDK/server identifiers → normalized step.
var RAW_TO_STEP = {
    'action:success': STEPS.SUCCESS,
    'action:journey': STEPS.SUCCESS,
    'action:rejection': STEPS.REJECTION,
    'action:information': STEPS.INFORMATION,
    'action:debug_break': STEPS.DEBUG_BREAK,
    'action:wait_for_another_device': STEPS.WAIT_FOR_ANOTHER_DEVICE,
    'action:wait_for_ticket': STEPS.WAIT_FOR_ANOTHER_DEVICE,
    'action:drs_trigger_action': STEPS.DRS_TRIGGER_ACTION,
    'action:id_verification': STEPS.IDENTITY_VERIFICATION,
    'action:webauthn_registration': STEPS.WEB_AUTHN_REGISTRATION,
    'transmit_platform_web_authn_registration': STEPS.WEB_AUTHN_REGISTRATION,
    'transmit_platform_transaction_signing_webauthn': STEPS.WEB_AUTHN_TRANSACTION_SIGNING,
    'transmit_platform_device_registration': STEPS.REGISTER_DEVICE_ACTION,
    'transmit_platform_device_validation': STEPS.VALIDATE_DEVICE_ACTION,
    'transmit_platform_mobile_biometrics_registration': STEPS.NATIVE_BIOMETRICS_REGISTRATION,
    'transmit_platform_mobile_biometrics_authentication': STEPS.NATIVE_BIOMETRICS_AUTHENTICATION,
    'transmit_platform_mobile_biometrics_transaction_signing': STEPS.NATIVE_BIOMETRICS_TRANSACTION_SIGNING,
    'transmit_platform_delete_mobile_biometrics': STEPS.DELETE_MOBILE_BIOMETRICS,
    'transmit_platform_selfie_acquisition': STEPS.SELFIE_ACQUISITION,
    'transmit_platform_email_otp_authentication': STEPS.EMAIL_OTP_AUTHENTICATION,
    'transmit_platform_sms_otp_authentication': STEPS.SMS_OTP_AUTHENTICATION,
    'transmit_platform_generic_otp_authentication': STEPS.GENERIC_OTP_AUTHENTICATION,
    'transmit_platform_validate_otp': STEPS.OTP_VALIDATION,
    'transmit_platform_email_validation': STEPS.EMAIL_VALIDATION,
    'transmit_platform_sms_validation': STEPS.SMS_VALIDATION,
    'transmit_platform_totp_registration': STEPS.TOTP_REGISTRATION,
    'transmit_platform_transaction_signing_totp': STEPS.TOTP_SIGNING_TRANSACTION,
    'transmit_platform_mobile_pin_registration': STEPS.PIN_CODE_REGISTRATION,
    'transmit_platform_mobile_pin_authentication': STEPS.PIN_CODE_AUTHENTICATION,
    'transmit_platform_mobile_pin_transaction_signing': STEPS.PIN_CODE_TRANSACTION_SIGNING,
    'transmit_platform_delete_pin_code': STEPS.PIN_CODE_DELETION,
    'transmit_platform_authentication': STEPS.AUTHENTICATION,
};

// Native enum case / constant names → normalized step. Covers the Android
// PascalCase names (TSIdoJourneyActionType.Information) and the iOS camelCase
// case names, in case a future SDK forwards those instead of the raw string.
var NAME_TO_STEP = {
    success: STEPS.SUCCESS,
    rejection: STEPS.REJECTION,
    information: STEPS.INFORMATION,
    debugbreak: STEPS.DEBUG_BREAK,
    waitforanotherdevice: STEPS.WAIT_FOR_ANOTHER_DEVICE,
    drstriggeraction: STEPS.DRS_TRIGGER_ACTION,
    identityverification: STEPS.IDENTITY_VERIFICATION,
    registerdevice: STEPS.REGISTER_DEVICE_ACTION,
    registerdeviceaction: STEPS.REGISTER_DEVICE_ACTION,
    validatedeviceaction: STEPS.VALIDATE_DEVICE_ACTION,
    webauthnregistration: STEPS.WEB_AUTHN_REGISTRATION,
    webauthntransactionsigning: STEPS.WEB_AUTHN_TRANSACTION_SIGNING,
    transactionsigningwebauthn: STEPS.WEB_AUTHN_TRANSACTION_SIGNING,
    registernativebiometrics: STEPS.NATIVE_BIOMETRICS_REGISTRATION,
    nativebiometricsregistration: STEPS.NATIVE_BIOMETRICS_REGISTRATION,
    authenticatenativebiometrics: STEPS.NATIVE_BIOMETRICS_AUTHENTICATION,
    // iOS 1.2.2 spells this case "nativeBiometricsAuthenticaton" (SDK typo).
    nativebiometricsauthenticaton: STEPS.NATIVE_BIOMETRICS_AUTHENTICATION,
    nativebiometricsauthentication: STEPS.NATIVE_BIOMETRICS_AUTHENTICATION,
    unregisternativebiometrics: STEPS.DELETE_MOBILE_BIOMETRICS,
    deletemobilebiometrics: STEPS.DELETE_MOBILE_BIOMETRICS,
    transactionsigningnativebiometrics: STEPS.NATIVE_BIOMETRICS_TRANSACTION_SIGNING,
    nativebiometricstransactionsigning: STEPS.NATIVE_BIOMETRICS_TRANSACTION_SIGNING,
    selfieacquisition: STEPS.SELFIE_ACQUISITION,
    emailotpauthentication: STEPS.EMAIL_OTP_AUTHENTICATION,
    smsotpauthentication: STEPS.SMS_OTP_AUTHENTICATION,
    genericotpauthentication: STEPS.GENERIC_OTP_AUTHENTICATION,
    validateotp: STEPS.OTP_VALIDATION,
    otpvalidation: STEPS.OTP_VALIDATION,
    emailvalidation: STEPS.EMAIL_VALIDATION,
    smsvalidation: STEPS.SMS_VALIDATION,
    totpregistration: STEPS.TOTP_REGISTRATION,
    transactionsigningtotp: STEPS.TOTP_SIGNING_TRANSACTION,
    totpsigningtransaction: STEPS.TOTP_SIGNING_TRANSACTION,
    pincoderegistration: STEPS.PIN_CODE_REGISTRATION,
    pincodeauthentication: STEPS.PIN_CODE_AUTHENTICATION,
    pincodetransactionsigning: STEPS.PIN_CODE_TRANSACTION_SIGNING,
    pincodedeletion: STEPS.PIN_CODE_DELETION,
    authentication: STEPS.AUTHENTICATION,
    debug_break: STEPS.DEBUG_BREAK,
};

function normalize(journeyStepId) {
    if (typeof journeyStepId !== 'string' || journeyStepId === '') return null;

    var raw = RAW_TO_STEP[journeyStepId];
    if (raw) return raw;

    var byName = NAME_TO_STEP[journeyStepId.replace(/[_\s-]/g, '').toLowerCase()];
    if (byName) return byName;

    // Custom / unrecognized step: hand the raw identifier back so callers can
    // still branch on it instead of losing the value.
    return journeyStepId;
}

// Journey response option ids understood by submitClientResponse(). Anything
// else is forwarded to the SDK as a custom option id.
var RESPONSE_OPTIONS = {
    CLIENT_INPUT: 'clientInput',
    CANCEL: 'cancel',
    FAIL: 'fail',
    RESEND: 'resend',
};

// The server spells the built-in options in snake_case in `clientResponseOptions`
// (option.id === 'client_input'), while submitClientResponse expects the canonical
// camelCase token. Passing the raw id would make the SDK send it as a *custom
// escape* — which the server rejects with "Session rejected" when the step has no
// such escape. Accepting both spellings removes that trap.
var RESPONSE_OPTION_ALIASES = {
    client_input: RESPONSE_OPTIONS.CLIENT_INPUT,
    clientinput: RESPONSE_OPTIONS.CLIENT_INPUT,
    cancel: RESPONSE_OPTIONS.CANCEL,
    fail: RESPONSE_OPTIONS.FAIL,
    action_failure: RESPONSE_OPTIONS.FAIL,
    resend: RESPONSE_OPTIONS.RESEND,
};

/**
 * Maps a built-in response option id/type onto the canonical token the native
 * bridges understand. Custom option ids are returned untouched.
 */
function normalizeResponseOptionId(responseId) {
    if (typeof responseId !== 'string' || responseId === '') return responseId;
    var alias = RESPONSE_OPTION_ALIASES[responseId];
    return alias || RESPONSE_OPTION_ALIASES[responseId.toLowerCase()] || responseId;
}

// Instruction types the SDK can emit mid-step (see addJourneyResponseListener).
var INSTRUCTIONS = {
    PIN_CODE_REGISTRATION_COMMIT: 'pinCodeRegistrationCommit',
    PIN_CODE_DELETION_COMMIT: 'pinCodeDeletionCommit',
};

var RAW_TO_INSTRUCTION = {
    mobile_pin_commit_key_creation: INSTRUCTIONS.PIN_CODE_REGISTRATION_COMMIT,
    mobile_pin_commit_key_deletion: INSTRUCTIONS.PIN_CODE_DELETION_COMMIT,
    PinCodeRegistrationCommit: INSTRUCTIONS.PIN_CODE_REGISTRATION_COMMIT,
    PinCodeDeletionCommit: INSTRUCTIONS.PIN_CODE_DELETION_COMMIT,
    pinCodeRegistrationCommit: INSTRUCTIONS.PIN_CODE_REGISTRATION_COMMIT,
    pinCodeDeletionCommit: INSTRUCTIONS.PIN_CODE_DELETION_COMMIT,
};

function normalizeInstruction(instructionType) {
    if (typeof instructionType !== 'string' || instructionType === '') return null;
    return RAW_TO_INSTRUCTION[instructionType] || instructionType;
}

module.exports = {
    STEPS: STEPS,
    RESPONSE_OPTIONS: RESPONSE_OPTIONS,
    INSTRUCTIONS: INSTRUCTIONS,
    normalize: normalize,
    normalizeInstruction: normalizeInstruction,
    normalizeResponseOptionId: normalizeResponseOptionId,
};
