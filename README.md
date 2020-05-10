# nxauth-node-express

## Installation

```bash
$ npm install @next-adv/nxauth-node-express --save
```

Or using [`yarn`](https://yarnpkg.com/en/)

```bash
$ yarn add @next-adv/nxauth-node-express
```

### Usage

```javascript
const Auth = require("@next-adv/nxauth-node-express");

const auth = new Auth({
    authDomain: "DOMAIN NAME",
    authIssuer: "TOKEN ISSUER",
    secretKey: "LONG STRING",
    usernameField: "email", 
    passwordField: "password", 
    provider: "simple", // or "firebase", 
    redisCli: redis.createClient(), // need for firebase
    UserModel,
    firebase: { // need for firebase
        tokenprefix: "expreess-test", // redis prefix for token cache
        serviceAccount: path.join(__dirname,".","SERVICE ACCOUNT PATH"),
        databaseURL: "NOME DATABASE.firebaseio.com"
    }
});
```