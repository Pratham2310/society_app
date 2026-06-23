require("dotenv").config();
const mongoose = require("mongoose");

// import models
require("./models/User");
const Society = require("./models/Society");
require("./models/Wing");
require("./models/Flats");
require("./models/ParkingSlot");
require("./models/ParkingAllotment");
require("./models/Fund");
require("./models/Contribution");
require("./models/Notice");
require("./models/Visitor");
require("./models/Announcment");
require("./models/Events");
require("./models/Complaint");
require("./models/Invite");
require("./models/Notification");

async function connectDB() {

    try {

        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB Connected");
        console.log("All Models Registered");

        // insert one test document so MongoDB creates the database
        await Society.create({
            name: "Test Society",
            city: "Nashik"
        });

        console.log("Test document inserted");

        process.exit();

    } catch (error) {

        console.error("Database error:", error);
        process.exit(1);

    }

}

connectDB();