
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { machineIdSync } = require("node-machine-id");
const AbstractUserModel = require("./AbstractUserModel");
const package = require("../package.json")
const colors = require("colors");

class Simple {
    /**
     * 
     * @param {UserModel, secretKey} options 
     */
    constructor(options) {
        const { authDomain, authIssuer, UserModel, UserModelType, usernameField, passwordField, passwordVerify, secretKey } = options;
        this.authDomain = authDomain || "null.domain.com",
        this.authIssuer = authIssuer || "express-test-example",
        this.usernameField = usernameField || "email";
        this.passwordField = passwordField || "password";
        this.secretKey = secretKey || crypto.createHash("sha256").update(machineIdSync() + __dirname).digest("hex");
        this.UserModel = new AbstractUserModel(UserModel, UserModelType || "mongoose");
        this.verify = passwordVerify ? passwordVerify : this.default;
        this.options = options || {};
        console.log(package.name.cyan, package.version.yellow, "Class SimpleAuth Initialized")
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
            let user;
            if(this.options.populate) {
                user = await this.UserModel.findOne(query).populate(this.options.populate);
            } else {
                user = await this.UserModel.findOne(query);
            }
            if (!user) return false;
            const result = await this.verify(password, user[this.passwordField]);
            return result ? user : false;
        } catch (err) {
            throw err;
        }
    }

    createPassword(password) {
        try {
            const pwd = crypto.createHash("sha256").update(this.secretKey + password).digest("hex");
            const salt = crypto.randomBytes(32).toString('hex');
            const key = crypto.pbkdf2Sync(pwd, salt, 2048, 64, 'sha512');
            return [salt,key].join("$");
        } catch (err) {
            throw err;
        }
    }
    verifyPassword(password, original) {
        const [salt,originalHash] = original.split('$');
        const hash = crypto.pbkdf2Sync(password, salt, 2048, 64, 'sha512').toString('hex');
        return hash === originalHash;
    }

    async middleware(token) {
        const json = await this.verifyToken(token);
        if (json) {
            try {
                let user;
                if(this.options.populate) {
                    user = await this.UserModel.findById(json.id).populate(this.options.populate);
                } else {
                    user = await this.UserModel.findById(json.id);
                }
                return { user }
            } catch (err) {
                console.error(package.name, package.version, err.message);
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
            return this.verifyPassword(test, hashed);
        } catch (err) {
            console.error(package.name, package.version, err.message);
            return false;
        }
    }
}

module.exports = Simple;