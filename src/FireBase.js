const { promisify } = require("util");
const admin = require("firebase-admin");
const {AuthErrors, AuthError} = require("./Errors");
const AbstractUserModel = require("./AbstractUserModel");

class FireBase {
    constructor(options) {
        const { UserModel, UserModelType, redisCli, serviceAccount, databaseURL, tokenprefix } = options;
        if(!UserModel) throw new Error("NO MODEL")
        this.client = redisCli;
        this.serviceAccount = serviceAccount;
        this.databaseURL = databaseURL;
        this.UserModel = new AbstractUserModel(UserModel, UserModelType || "mongoose");
        this.tokenprefix = tokenprefix;
        if (!this.client) return false;
        this.bind();
    }

    bind() {
        admin.initializeApp({
            credential: admin.credential.cert(this.serviceAccount),
            databaseURL: this.databaseURL
        });/*  */
        this.aget = promisify(this.client.get).bind(this.client);
        this.aset = promisify(this.client.set).bind(this.client);
        this.adel = promisify(this.client.del).bind(this.client);
        console.log("Class FirebaseAuth Initialized, token prefix", this.tokenprefix)
    }

    async purge(token) {
        try {
            await this.adel(`${this.tokenprefix}:${token}`);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    async middleware(token) {
        try {
            let cache = await this.aget(`${this.tokenprefix}:${token}`);
            if (!cache) {
                const result = await this.login(token);
                return result.user;
            }
            return JSON.parse(cache);
        } catch (err) {
            console.error(err)
            return false;
        }
    }


    async verifyToken(token) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            return decodedToken;
        } catch (err) {
            console.error(err)
            return false;
        }

    }

    async logout(token) {
        try {
            await this.adel(`${this.tokenprefix}:${token}`);
            return true;
        } catch (error) {
            console.log(error)
            this.client.del(`${this.tokenprefix}:${token}`);
        }
    }

    async login(token) {
        const decodedToken = await admin.auth().verifyIdToken(token);
        let firebaseId = decodedToken.uid || decodedToken.user_id;
        try {
            const exp = decodedToken.exp - Math.floor(Date.now() / 1000);
            const founduser = await this.UserModel.findOne({ firebaseId });
            if (founduser) {
                await founduser.populate("services").populate("availability");
                await this.aset(`${this.tokenprefix}:${token}`, JSON.stringify(founduser), 'EX', exp);
                return { result: true, user: founduser };
            } else {
                console.error(AuthErrors.FIREBASE_USERISNEW)
                throw new AuthError(AuthErrors.FIREBASE_USERISNEW);
            }
        } catch (error) {
            console.error(error)
            throw error;
        }

    }
}

module.exports = FireBase;