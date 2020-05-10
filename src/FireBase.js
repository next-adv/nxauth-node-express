const {promisify} = require("util");
const admin = require("firebase-admin");
const Errors = require("./Errors")
const Banlist = require("./Banlist")

class FireBase {
    constructor(options) {
        const { UserModel, redisCli, serviceAccount, databaseURL, tokenprefix } = options;
        this.client = redisCli;
        this.serviceAccount = serviceAccount;
        this.databaseURL = databaseURL;
        this.UserModel = UserModel;
        this.tokenprefix = tokenprefix
        if(!this.client) return false;
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
        
    }

    async middleware(token) {
        try{
            let user = await this.verifyToken(`${this.tokenprefix}:${token}`);
            if(!user) {
                const result = await this.login(token);
                return result.user;
            }
            return JSON.parse(user);
        } catch(err) {
            console.error(err)
            return false;
        }
    }

    async verifyToken(token) {
        try{
            const user = await this.aget(`${this.tokenprefix}:${token}`);
            if(!user) {
                return false;
            }
            return JSON.parse(user);
        } catch(err) {
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
        return admin.auth().verifyIdToken(token)
        .then(async (decodedToken) => {
            let firebaseId = decodedToken.uid || decodedToken.user_id;
            const exp = decodedToken.exp - Math.floor(Date.now() / 1000);
            try {
                const founduser = await this.UserModel.findOne({ firebaseId }).populate("services").populate("availability");
                if (founduser) {
                    await this.aset(`${this.tokenprefix}:${token}`, JSON.stringify(founduser), 'EX', exp);
                    return { result: true, user: founduser };
                } else {
                    return { result: false, error: Errors.FIREBASE_USERISNEW, code: 440 };
                }
            } catch (error) {
                console.error("err", error);
                return { result: false, error: error.message, code: 500 };
            }
        }).catch(function (error) {
            console.error("error", error);
            return { result: false, error: error.message, code: 500 };
        });
    }
}

module.exports = FireBase;