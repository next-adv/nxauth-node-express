
const data = {
    GENERIC: {message: "nxex-generic-erro", code: 500},
    UNAUTHORIZED: {message: "nxex-unauthorized-erro", code: 401},
    FIREBASE_USERISNEW: {message: "nxex-firebase-user-is-new", code: 440},
    NOFIREBASEID: {message: "nxex-firebase-id-missing", code: 400},
    DUPLICATE_USER_EMAIL: {message: "nxex-duplicate-user-data-email", code: 400},
    BANNED_USER: {message: "nxex-banned-user-data", code: 400},
    BANNED_TOKEN: {message: "nxex-banned-token-data", code: 400},
    ROUTES_ERROR: {message: "nxex-routes-error", code: 500},
}

class AuthError extends Error {
    constructor(message) {
        if(!data[message]) message === "GENERIC";
        super(data[message].message);
        this.name = "AuthError";
        this.code = data[message].code;
    }
}

const constants = {
    GENERIC: "GENERIC",
    FIREBASE_USERISNEW: "FIREBASE_USERISNEW",
    FIREBASE_NOID: "NOFIREBASEID",
    DUPLICATE_USER_EMAIL: "DUPLICATE_USER_EMAIL",
    BANNED_USER: "BANNED_USER",
    BANNED_TOKEN: "BANNED_TOKEN",
    UNAUTHORIZED: "UNAUTHORIZED",
    ROUTES_ERROR: "ROUTES_ERROR",
};

module.exports = {
    AuthError,
    AuthErrors: constants
}