const Firebase = require("./src/FireBase");
const Simple = require("./src/Simple");
const Banlist = require("./src/Banlist");
const Errors = require("./src/Errors");

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
        usernameField, passwordField, UserModel,
        firebase, redisCli, tokenprefix
    }) {
        if (!provider) provider = "simple";
        this.authDomain = authDomain;
        this.authIssuer = authIssuer;
        this.client = redisCli;
        this.usernameField = usernameField;
        this.passwordField = passwordField;
        this.UserModel = UserModel;
        this.secretKey = secretKey;
        this.redis = redisCli;
        this.provider = provider;

        switch (provider.toLowerCase()) {
            default:
            case "simple":
                this.AuthHandler = new Simple({ authDomain, authIssuer, UserModel, usernameField, passwordField, secretKey });
                break;
            case "firebase":
                const serviceAccount = require(firebase.serviceAccount);
                const databaseURL = firebase.databaseURL;
                this.AuthHandler = new Firebase({ databaseURL, serviceAccount, redisCli, tokenprefix });
                break;
        }
        this.middleware = this.middleware.bind(this);

    }
    
    /**
     * Creates a user
     * 
     * @param {*} data
     * @returns mongoose.Model
     * @memberof Auth
     */
    async register(data) {
        try {
            switch (this.provider.toLowerCase()) {
                default:
                case "simple":
                    const pwd = await this.AuthHandler.createPassword(data[this.passwordField]);
                    data[this.passwordField] = pwd;
                    return await this.UserModel.create(data);
                case "firebase":
                    if (!data.firebaseId) throw new Error(Errors.NOFIREBASEID);
                    return await this.UserModel.create(data);
            }
        } catch (err) {
            console.error(err.message)
            if (err.code === 11000) {
                throw new Error(Errors.DUPLICATE_USER_EMAIL);
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
            const pwd = await this.AuthHandler.createPassword(newpass);
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
            return res.status(401).json({ message: "Unauthorized" })
        }
        const result = await this.AuthHandler.middleware(req.headers.authorization.replace("Bearer ", ""));
        if (!result || !result.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const isBanned = await Banlist.findOne({ $or: [{ token }, { user: result.id }] });
        if (isBanned) return res.status(403).json({ message: Errors.BANNED_TOKEN });
        req.user = result.user;
        next();
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
            await this.AuthHandler.logout(token);
            await Banlist.create({ token });
            return { result: true };
        } catch (error) {
            return { result: true };
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
    async firebase(token) {
        try {
            const { result, user, error, code } = await this.AuthHandler.login(token);
            if (error) throw new Error(error);
            if (!result) return false;
            const banned = await Banlist.findOne({ user: user.id })
            if (banned) throw new Error({ message: Errors.BANNED_USER, code: 403 });
            return { user };
        } catch (err) {
            throw err;
        }
    }
}

module.exports = Auth;