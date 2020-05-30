
const hash = require("crypto").createHash;
const jwt = require("jsonwebtoken");
const bcrypt = require('bcrypt');
const { machineIdSync } = require("node-machine-id");
const AbstractUserModel = require("./AbstractUserModel");

class Simple {
    /**
     * 
     * @param {UserModel, secretKey} options 
     */
    constructor(options) {
        const { authDomain, authIssuer, UserModel, UserModelType, usernameField, passwordField, passwordVerify, secretKey } = options;
        this.authDomain = authDomain || "null.domain.com",
            this.authIssuer = authIssuer || "expreess-test-example",
            this.usernameField = usernameField || "email";
        this.passwordField = passwordField || "password";
        this.secretKey = secretKey || hash("sha256").update(machineIdSync() + __dirname).digest("hex");
        this.UserModel = new AbstractUserModel(UserModel, UserModelType || "mongoose");
        this.verify = passwordVerify ? passwordVerify : this.default;
        this.saltrounds = options.saltrounds || 12;

    }

    async purge(token) {
        return Promise.resolve(true);
    }

    async logout(token) {
        try {
            return { result: true };
        } catch (err) {
            throw err;
        }
    }

    async login(username, password) {
        const query = { [this.usernameField]: username };
        try {
            const user = await this.UserModel.findOne(query);
            if (!user) return false;
            const result = await this.verify(password, user[this.passwordField]);
            return result ? user : false;
        } catch (err) {
            throw err;
        }
    }

    async createPassword(password) {
        try {
            console.log("secret", this.secretKey, password)
            const pwd = hash("sha256").update(this.secretKey + password).digest("hex");
            const bpwd = await bcrypt.hash(pwd, this.saltrounds);
            return bpwd;
        } catch (err) {
            throw err;
        }
    }

    async middleware(token) {
        const json = await this.verifyToken(token);
        if (json) {
            try {
                const user = await this.UserModel.findById(json.id);
                return { user }
            } catch (err) {
                console.error(err)
                return false;
            }
        }
        return false;
    }

    createToken(data) {
        return jwt.sign({ ...data, iss: this.authIssuer, domain: this.authDomain }, this.secretKey);
    }

    async verifyToken(token) {
        return jwt.decode(token, this.secretKey);
    }

    async default(password, hashed) {
        try {
            const test = hash("sha256").update(this.secretKey + password).digest("hex");
            return await bcrypt.compare(test, hashed);
        } catch (err) {
            console.log(err)
            return false;
        }
    }
}

module.exports = Simple;