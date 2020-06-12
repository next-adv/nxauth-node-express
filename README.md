# nxauth-node-express

## Installation

```bash
$ npm install @next-adv/nxauth-node-express --save
```

Or using [`yarn`](https://yarnpkg.com/en/)

```bash
$ yarn add @next-adv/nxauth-node-express
```

Usage
=====

```javascript
const Auth = require("@next-adv/nxauth-node-express");

const auth = new Auth({
    authDomain: "DOMAIN NAME",
    authIssuer: "TOKEN ISSUER",
    secretKey: "LONG STRING", // required for simple
    usernameField: "email", 
    passwordField: "password", 
    provider: "simple", // or "firebase", 
    redisCli: redis.createClient(), // required for firebase
    UserModel,
    firebase: { // required for firebase
        tokenprefix: "expreess-test", // redis prefix for token cache
        serviceAccount: path.join(__dirname,".","SERVICE ACCOUNT PATH"),
        databaseURL: "NOME DATABASE.firebaseio.com"
    },
    authOptions // options to populate subobjects of User
});

...
```

# Configurazione Routes e handlers

Utilizzare un oggetto routes da passare all'inizializzatore con i seguenti parametri

```javascript
const routes = [
    { path: "/", handler: indexRouter, public: true }, //indexRouter è il controller importato, public toglie i middleware
    { path: "/users", handler: usersRouter, public: true },
]
const init = (app, middlewares) => {
    for(const route of routes){
        const rest = [...(!route.public? middlewares : []), route.handler]
        app.use(route.path, ...rest)
    }
}
module.exports = {
    init,
    routes
}

```
e poi passarlo alla classe auth 

```javascript
const routes = require("./routes");
const app = express();

...

const auth = new Auth(options);
auth.setRoutes(routes, app)
```

# Middleware per passare l'oggetto auth e user nelle request

```javascript
app.use((req,res,next) => {
    req.auth = auth;
    next();
});

app.use('/users', auth.middleware, usersRouter);
```

Examples
===========

Negli endpoint autenticati, l'oggetto request contiene auth e user come parametri aggiuntivi.
L'oggetto _req.auth_ è l'interfaccia con la struttura utente e utilizza una classe per ogni tipo di autenticazione. 

```javascript
router.post('/auth', async (req, res, next) => {
  try {
    let result;
    switch (req.auth.provider) {
      case "firebase":
        result = await req.auth.firebaseAccess(req.headers.authorization.replace("Bearer ", ""));
        if (result.user) {
            return res.json({ result: true, user: result.user });
        } else {
            return res.status(404).json({ result: false });
        }
      case "simple":
      default:
        result = await req.auth.login(req.body.email, req.body.password);
        if (result.user) {
            return res.json({ result: true, user: result.user, token: result.token });
        } else {
            return res.status(404).json({ result: false });
        }
    }
  } catch (err) {
    res.status(404).json({ result: false, message: err.message });
  }
});

```

L' oggetto _req.user_ è un **mongoose.Model** in tutte le chiamate autenticate

```javascript
router.put('/me', async (req, res, next) => {
  req.user.lastUpdate = Date.now();
  try {
    const usersave = await req.user.save();
    const user = await usersave.toObject();

    delete user.password;
    delete user._v;
    res.json({ user });
  } catch (err) {
    console.error(err)
    res.status(500).json(err)
  }
});
```