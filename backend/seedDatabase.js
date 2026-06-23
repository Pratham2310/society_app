require("dotenv").config();
const mongoose = require("mongoose");

// Models
const Society = require("./models/Society");
const Wing = require("./models/Wing");
const Flat = require("./models/Flats");
const User = require("./models/User");
const ParkingSlot = require("./models/ParkingSlot");
const ParkingAllotment = require("./models/ParkingAllotment");
const Notice = require("./models/Notice");
const Announcement = require("./models/Announcment");
const Event = require("./models/Events");
const Fund = require("./models/Fund");
const Contribution = require("./models/Contribution");
const Complaint = require("./models/Complaint");
const Visitor = require("./models/Visitor");
const Invite = require("./models/Invite");
const Notification = require("./models/Notification");

async function seedDB() {

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Connected");

    // SOCIETY
    const society = await Society.create({
        name: "Green Valley Society",
        city: "Nashik"
    });

    // WING
    const wing = await Wing.create({
        societyId: society._id,
        name: "A Wing",
        numberOfFloors: 5
    });

    // FLAT
    const flat = await Flat.create({
        societyId: society._id,
        wingId: wing._id,
        flatNumber: "A-101",
        floorNumber: 1
    });

    // USER
    const user = await User.create({
        name: "Rahul Sharma",
        email: "rahul@test.com",
        password: "123456",
        role: "resident",
        societyId: society._id,
        flatId: flat._id
    });

    // PARKING SLOT
   const slot = await ParkingSlot.create({
        societyId: society._id,
        slotNumber: "P1",
        type: "resident",   // required field
        isOccupied: true
    });
    // PARKING ALLOTMENT
    await ParkingAllotment.create({
        societyId: society._id,
        userId: user._id,
        flatId: flat._id,
        slotId: slot._id,
        vehicleType: "car",
        vehicleNumber: "MH15AB1234"
    });

    // NOTICE
    await Notice.create({
        societyId: society._id,
        title: "Water Shutdown",
        description: "Maintenance work tomorrow",
        createdBy: user._id
    });

    // ANNOUNCEMENT
    await Announcement.create({
        societyId: society._id,
        title: "Security Update",
        category: "security",
        description: "New visitor rules implemented",
        createdBy: user._id
    });

    // EVENT
    await Event.create({
        societyId: society._id,
        title: "Community Clean Up",
        description: "Garden cleaning activity",
        location: "Main Garden",
        eventDate: new Date(),
        createdBy: user._id
    });

    // FUND
    const fund = await Fund.create({
        societyId: society._id,
        title: "Ganpati Festival Fund",
        amount: 500
    });

    // CONTRIBUTION
    await Contribution.create({
        societyId: society._id,
        fundId: fund._id,
        userId: user._id,
        flatId: flat._id,
        amount: 500,
        status: "paid"
    });

    // COMPLAINT
    await Complaint.create({
        societyId: society._id,
        userId: user._id,
        title: "Water Leakage",
        description: "Pipe leaking near staircase",
        status: "pending"
    });

    // VISITOR
    await Visitor.create({
        societyId: society._id,
        flatId: flat._id,
        visitorName: "Amit",
        phone: "9876543210",
        purpose: "Guest"
    });

    // INVITE
    await Invite.create({
        email: "newmember@test.com",
        societyId: society._id,
        flatId: flat._id,
        role: "resident",
        token: "invite123",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
        used: false
    });
    console.log(Notification);
    // NOTIFICATION
    await Notification.create({
        userId: user._id,
        societyId: society._id,
        title: "New Notice",
        message: "Water shutdown tomorrow",
        type: "notice"
    });

    console.log("Dummy Data Inserted Successfully");

    process.exit();
}

seedDB();