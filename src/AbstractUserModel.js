const mongoose = require("mongoose");


class AbstractUserModel {
    
    constructor(model, type) {
        this.type = type || 'mongoose';
        this.data = [];
        this.model = model;
        if(this.type === "mongoose"){
            this.create = (data) => this.model.create(data);
            this.findById = (id) => this.model.findById(id);
            this.findByIdAndUpdate = (id, data,options) => this.model.findByIdAndUpdate(id, data,options);
            this.findByIdAndDelete = (id, data,options) => this.model.findByIdAndDelete(id, data,options);
            this.findOneAndUpdate = (query, data, options) => this.model.findOneAndUpdate(query, data, options);
            this.findOneAndDelete = (query, data, options) => this.model.findOneAndDelete(query, data, options);
        } else {
            this.type = "json";
            this.defaultModel = {
                findOne: (query) => {
                    return this.data.find(d => {
                        for(const param in query){
                            if(!this.data[param] || this.data[param] !== query[param]) return false;
                        }
                        return true;
                    })
                },
                find: (query) => {
                    return this.data.filter(d => {
                        for(const param in query){
                            if(!this.data[param] || this.data[param] !== query[param]) return false;
                        }
                        return true;
                    })
                }
            }
            this.model = this.defaultModel;
            if(Array.isArray(model)){
                this.data = model;
            } else {
                this.data = [model];
            }
            this.findOne = (query, options) => this.model.findOne(query, options)
            this.find  = (query, projection, options) => this.model.find(query, projection, options)
        }

        this.findOne = (query, options) => this.model.findOne(query, options)
        this.find = (query, projection, options) => this.model.find(query, projection, options);
        
    }
}

module.exports = AbstractUserModel;