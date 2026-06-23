const Service= require("../models/Service");

class serviceRepository{
    async getServiceBySociety(societyId){
        return Service.find({societyId})
        .select("name type timing phone")
        .sort({createdAt:-1});
    }

    async create(data){
        return Service.create(data);
    }

    async getAll(){
        return Service.find().sort({createdAt:-1});
    }

    async update(id,data)
    {
        return Service.findByIdAndUpdate(id,data,{new:true});
    }
}

module.exports=new serviceRepository();