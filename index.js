const Firebase = require("./src/FireBase");
const Simple = require("./src/Simple");
const Banlist = require("./src/Banlist");
const Errors = require("./src/Errors");

class Auth {
    constructor ({
        authDomain, authIssuer, provider, secretKey,
        usernameField, passwordField, UserModel,
        firebase, redisCli, tokenprefix
    }) {
        this.authDomain = authDomain;
        this.authIssuer = authIssuer;
        this.client = redisCli;
        this.usernameField = usernameField;
        this.passwordField = passwordField;
        this.UserModel = UserModel;
        this.secretKey = secretKey;
        this.redis = redisCli;
        if(!provider) return false;
        this.provider = provider;
        switch(provider.toLowerCase()) {
            default:
            case "simple":
                this.loginClass = new Simple({authDomain, authIssuer, UserModel, usernameField, passwordField, secretKey});
                break;
            case "firebase":
                const serviceAccount = require(firebase.serviceAccount);
                const databaseURL = firebase.databaseURL;
                this.loginClass = new Firebase({databaseURL, serviceAccount, redisCli, tokenprefix});
                break;
        }
        this.middleware = this.middleware.bind(this);

    }

    async register(data) {
        try {
            switch(this.provider.toLowerCase()) {
                default:
                case "simple":
                    const pwd = await this.loginClass.createPassword(data[this.passwordField]);
                    data[this.passwordField] = pwd;
                    return await this.UserModel.create(data);
                case "firebase":
                    if(!data.firebaseId) throw new Error(Errors.NOFIREBASEID);
                    return await this.UserModel.create(data);
            }
        } catch(err) {
            console.error(err.message)
            if(err.code === 11000){
                throw new Error(Errors.DUPLICATE_USER_EMAIL);
            }
            throw err;

        }
    }

    async updatePassword(id, newpass) {
        try {
            const pwd = await this.loginClass.createPassword(newpass);
            console.log("hashed",pwd)
            return await this.UserModel.findByIdAndUpdate(id, { $set: { [this.passwordField] : pwd}}, {new: true});
        } catch(err) {
            throw err;
        }
    }

    async middleware(req,res,next) {
        if(!req.headers.authorization) {
            return res.status(401).json({message: "Unauthorized"})
        }
        const result = await this.loginClass.middleware(req.headers.authorization.replace("Bearer ",""));
        if(!result || !result.user) {
            return res.status(401).json({message: "Unauthorized"});
        }
        const isBanned = await Banlist.findOne({ $or: [{ token }, { user: result.id }] });
         if(isBanned) return res.status(403).json({message: Errors.BANNED_TOKEN});
        req.user = result.user;
        next();
    }

    async logout (token) {
        try {
            await this.loginClass.logout(token);
            await Banlist.create({ token });
            return { result: true };
        } catch (error) {
            return { result: true };
        }
    }

    async login (username, password) {
        try {
            const user = await this.loginClass.login(username, password);
            if(!user) return false;
            const token = this.loginClass.createToken({id: user.id, exp: Math.floor((Date.now() + 24 * 3600 * 60)/1000), iss: this.authIssuer})
            return {user, token};
        } catch(err) {
            throw err;
        }
    }

    async verifyToken(token) {
        try {
            return await this.loginClass.verifyToken(token);
        } catch(err) {
            throw err;
        }
    }

    async firebase(token) {
        try {
            const { result, user, error, code } = await this.loginClass.login(token);
            if(error) throw new Error(error);
            if(!result) return false;
            const banned = await Banlist.findOne({user: user.id})
            if(banned) throw new Error({message: Errors.BANNED_USER, code: 403});
            return {user};
        } catch(err) {
            throw err;
        }
    }
}

module.exports = Auth;