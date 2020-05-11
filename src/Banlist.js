const mongoose = require("mongoose");
const Errors = require("./Errors");

const Schema = new mongoose.Schema({
    date: { type: Date, default: Date.now() },
    token: { type: String, unique: true, index: true },
    expire: { type: Date },
    user: { type: mongoose.Types.ObjectId, ref: 'User', index: true},
    owner: { type: mongoose.Types.ObjectId, ref: 'User'}
});

Schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret._v;
        
    }
});

const Banlist = mongoose.model('Banlist', Schema);

module.exports = Banlist;
