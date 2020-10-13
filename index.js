

const Firebase = require("./src/FireBase");
const Simple = require("./src/Simple");
const Banlist = require("./src/Banlist");
const { AuthError, AuthErrors } = require("./src/Errors");
const mongoose = require("mongoose");
const colors = require("colors");
const packageObj = require("./package.json");
const { init } = require("./src/Banlist");

class Auth {
    /**
     * Creates an instance of Auth.
     * @param {*} {
     *         authDomain, authIssuer, provider, secretKey,
     *         usernameField, passwordField, UserModel,
     *         firebase, redisCli, tokenprefix
     *     }
     * @memberof Auth
     */
    constructor({
        authDomain, authIssuer, provider, secretKey,
        usernameField, passwordField, UserModel, UserModelType,
        firebase, redisCli,
        mongooseUri, useUnifiedTopology, authOptions
    }) {
        if (!provider) provider = "simple";
        this.authDomain = authDomain;
        this.authIssuer = authIssuer;
        this.client = redisCli;
        this.usernameField = usernameField;
        this.passwordField = passwordField;
        this.UserModel = UserModel;
        this.UserModelType = UserModelType || "mongoose";
        this.secretKey = secretKey;
        this.redis = redisCli;
        this.provider = provider;
        this.firebase = firebase;

        this.middleware = this.middleware.bind(this);

        this.init(mongooseUri, authOptions || {}, useUnifiedTopology);
    }

    async init(mongooseUri, authOptions, useUnifiedTopology) {
        try {
            await mongoose.connect(mongooseUri, {
                useNewUrlParser: true,
                useUnifiedTopology: useUnifiedTopology || true,
                useCreateIndex: true
            })
            const { authDomain, authIssuer, provider, secretKey,
                usernameField, passwordField, UserModel, UserModelType,
                firebase, redisCli, } = this
            mongoose.set('useFindAndModify', false);
            console.log(packageObj.name.cyan, packageObj.version.yellow, "NXAUTH Mongo connected:".green, mongooseUri.yellow)

            switch (provider.toLowerCase()) {
                default:
                case "simple":
                    this.AuthHandler = new Simple({ authDomain, authIssuer, UserModel, UserModelType, usernameField, passwordField, secretKey, ...authOptions });
                    break;
                case "firebase":
                    const serviceAccount = require(firebase.serviceAccount);
                    const databaseURL = firebase.databaseURL;
                    this.AuthHandler = new Firebase({ UserModel, UserModelType, databaseURL, serviceAccount, redisCli, tokenprefix: firebase.tokenprefix });
                    break;
            }
        } catch (err) {
            console.error(err);
        }
    }
    setRoutes(routes, app) {
        if (routes && app) {
            this.app = app;
            this.routes = routes;
            try {
                app.use((req, res, next) => {
                    req.auth = this;
                    next();
                });
                routes.init(app, [this.middleware]);
                console.log(packageObj.name.cyan, packageObj.version.yellow, "NXAUTH Routes Created:".green, routes.routes.map(i => `path: ${i.path}`))
            } catch (err) {
                throw new AuthError(AuthErrors.ROUTES_ERROR.message)
            }
        }
    }

    /**
     * Creates a user
     * 
     * @param {*} data
     * @returns mongoose.Model
     * @memberof Auth
     */
    async register(data, token) {
        try {
            switch (this.provider.toLowerCase()) {
                default:
                case "simple":
                    const pwd = this.AuthHandler.createPassword(data[this.passwordField]);
                    data[this.passwordField] = pwd;
                    return await this.UserModel.create(data);
                case "firebase":
                    if (!token) throw new AuthError(AuthErrors.FIREBASE_NOID);
                    const decodedToken = await this.AuthHandler.verifyToken(token);
                    if (!decodedToken) throw new AuthError(AuthErrors.FIREBASE_NOID);
                    data.firebaseId = decodedToken.uid || decodedToken.user_id;
                    return await this.UserModel.create(data);
            }
        } catch (err) {
            if (err.code === 11000) {
                throw new AuthError(AuthErrors.DUPLICATE_USER_EMAIL);
            }
            throw err;

        }
    }

    /**
     * Updates a password
     *
     * @param {*} id
     * @param {*} newpass
     * @returns updated user
     * @memberof Auth
     */
    async updatePassword(id, newpass) {
        try {
            const pwd = this.AuthHandler.createPassword(newpass);
            return await this.UserModel.findByIdAndUpdate(id, { $set: { [this.passwordField]: pwd } }, { new: true });
        } catch (err) {
            throw err;
        }
    }


    /**
     * Express middleware, adds user iin the request from token data
     *
     * @param {*} req
     * @param {*} res
     * @param {*} next
     * @returns
     * @memberof Auth
     */
    async middleware(req, res, next) {
        if (!req.headers.authorization) {
            return res.status(401).json({ message: AuthErrors.UNAUTHORIZED })
        }
        let result;
        try {
            result = await this.AuthHandler.middleware(req.headers.authorization.replace("Bearer ", ""));
            if (!result) {
                console.log(packageObj.name.cyan, packageObj.version.yellow, "middleware: NO TOKEN RESULT")
                return res.status(401).json({ message: AuthErrors.UNAUTHORIZED });
            }
            req.user = result;
        } catch (err) {
            console.error(packageObj.name, packageObj.version, err.message);
            return res.status(401).json({ message: AuthErrors.UNAUTHORIZED });
        }
        try {
            const isBanned = await Banlist.findOne({ token: req.headers.authorization.replace("Bearer ", "") });
            if (isBanned) return res.status(403).json({ message: AuthErrors.BANNED_TOKEN });
        } catch (err) {
            console.error(packageObj.name, packageObj.version, err.message);
            return res.status(500).json({ message: AuthErrors.BANNED_TOKEN });
        }

        next();
    }

    /**
     * Purges a token
     *
     * @param {*} { token, user }
     * @returns result true
     * @memberof Auth
     */
    async purge(token) {
        try {
            token = token.replace("Bearer ", "")
            if (token) {
                await this.AuthHandler.purge(token);
            }
            return { result: true };
        } catch (error) {
            return { result: true };
        }
    }

    /**
     * Bans a user or a token
     *
     * @param {*} { token, user }
     * @returns result obj
     * @memberof Auth
     */
    async ban({ token, user }) {
        try {
            token = token.replace("Bearer ", "")
            if (token) {
                await this.AuthHandler.logout(token);
                await Banlist.create({ token });
            } else if (user) {
                await Banlist.create({ user });
            }
            return { result: true };
        } catch (error) {
            return { result: true };
        }
    }

    /**
     * Removes a ban from a user or a token
     *
     * @param {*} { token, user }
     * @returns result obj
     * @memberof Auth
     */
    async unban({ token, user }) {
        try {
            token = token.replace("Bearer ", "")
            if (token) {
                await Banlist.findOneAndDelete({ token });
            }
            if (user) {
                await Banlist.findOneAndDelete({ user });
            }
            return { result: true };
        } catch (error) {
            return { result: true };
        }
    }

    /**
     * Logs out  a token putting it in the banlist
     *
     * @param {*} token
     * @returns
     * @memberof Auth
     */
    async logout(token) {
        try {
            token = token.replace("Bearer ", "")
            await this.AuthHandler.logout(token);
            await Banlist.create({ token });
            return { result: true };
        } catch (error) {
            throw error;
        }
    }


    /**
     * Logs in with user credentials
     *
     * @param {*} username
     * @param {*} password
     * @returns
     * @memberof Auth
     */
    async login(username, password) {
        try {
            const user = await this.AuthHandler.login(username, password);
            if (!user) return false;
            const token = this.AuthHandler.createToken({ id: user.id, exp: Math.floor((Date.now() + 24 * 3600 * 60) / 1000), iss: this.authIssuer })
            return { user, token };
        } catch (err) {
            throw err;
        }
    }

    /**
     * Validates user token
     *
     * @param {*} token
     * @returns
     * @memberof Auth
     */
    async verifyToken(token) {
        try {
            token = token.replace("Bearer ", "")
            return await this.AuthHandler.verifyToken(token);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Logs in to firebase
     *
     * @param {*} token
     * @returns
     * @memberof Auth
     */
    async firebaseAccess(token) {
        try {
            token = token.replace("Bearer ", "")
            const { result, user, error, code } = await this.AuthHandler.login(token);
            if (error || !result) {
                throw new AuthError(AuthErrors.GENERIC);
            }

            const banned = await Banlist.findOne({ user: user.id })
            if (banned) throw new AuthError(AuthErrors.BANNED_USER);
            return { user };
        } catch (err) {
            console.error(packageObj.name, packageObj.version, err.message);
            throw err;
        }
    }
}

module.exports = Auth;