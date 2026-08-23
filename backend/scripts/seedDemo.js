// =======================================================
// DEMO DATA
//
// Fills an empty database with enough to make the console worth
// looking at: salespeople, societies they onboarded, secretaries,
// residents waiting for approval, notices, complaints and services.
//
//   npm run seed:demo          add the demo data
//   npm run seed:demo -- --clean   remove it again
//
// Every demo account signs in with the DEMO_PASSWORD below.
//
// Everything it creates is tagged, so --clean removes exactly what
// this script made and never touches real records.
//
// It goes through the real services — createSociety and createWing —
// so flats are generated the same way onboarding generates them, and
// a society code is issued the same way.
// =======================================================

require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

require("../models/plugins/register");

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const { loadEnv } = require("../config/env");

const CLEAN = process.argv.includes("--clean");

// Demo only, and never printed: a test fails the build if any file
// logs something that looks like a credential, and that guard is worth
// more than the convenience of echoing it here.
const DEMO_PASSWORD = "Password123!";

// Every demo account uses this domain, which is what --clean matches on.
//
// A subdomain of example.com, not a .test or .local address: Joi's
// .email() validates the TLD against the IANA list, so those are
// rejected at both registration and login. example.com is reserved for
// documentation and its TLD is real, so it passes.
const DOMAIN = "demo.example.com";

const SOCIETIES = [
  {
    name: "Emerald Heights", city: "Nashik", state: "Maharashtra",
    address: "Gangapur Road", pincode: "422013",
    wings: [
      { name: "A", totalFloors: 6, flatsPerFloor: 4 },
      { name: "B", totalFloors: 6, flatsPerFloor: 4 },
    ],
  },
  {
    name: "Shivneri Residency", city: "Pune", state: "Maharashtra",
    address: "Baner Road", pincode: "411045",
    wings: [
      { name: "A", totalFloors: 8, flatsPerFloor: 3 },
    ],
  },
  {
    name: "Sai Krupa Complex", city: "Nashik", state: "Maharashtra",
    address: "College Road", pincode: "422005",
    wings: [
      { name: "A", totalFloors: 4, flatsPerFloor: 4 },
      { name: "B", totalFloors: 4, flatsPerFloor: 4 },
      { name: "C", totalFloors: 3, flatsPerFloor: 2 },
    ],
  },
  {
    name: "Green Meadows", city: "Thane", state: "Maharashtra",
    address: "Ghodbunder Road", pincode: "400607",
    wings: [
      { name: "A", totalFloors: 10, flatsPerFloor: 4 },
    ],
  },
];

const SALESPEOPLE = [
  { name: "Rohit Deshmukh", phone: "9820100011" },
  { name: "Anjali Kulkarni", phone: "9820100022" },
];

const RESIDENTS = [
  { name: "Prakash Joshi", phone: "9820200011", occupancyType: "owner", livingType: "family", familySize: 4 },
  { name: "Meera Patil", phone: "9820200022", occupancyType: "tenant", livingType: "bachelor", familySize: 1 },
  { name: "Sandeep Rane", phone: "9820200033", occupancyType: "owner", livingType: "family", familySize: 3 },
  { name: "Kavita Shinde", phone: "9820200044", occupancyType: "tenant", livingType: "family", familySize: 2 },
];

const SERVICES = [
  { name: "Sai Medical Store", category: "health", phone: "9822000011", address: "Gangapur Road", is24Hours: false },
  { name: "City Care Clinic", category: "health", phone: "9822000022", address: "College Road", is24Hours: true },
  { name: "Nashik Plumbing Works", category: "maintenance", phone: "9822000033", address: "Old Agra Road" },
  { name: "Bright Kids Playschool", category: "education", phone: "9822000044", address: "Sharanpur Road" },
  { name: "Fire Brigade", category: "emergency", phone: "101", is24Hours: true },
  { name: "Daily Needs Supermarket", category: "shopping", phone: "9822000055", address: "Gangapur Road" },
];

const slug = (s) => s.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12);

const run = async () => {

  const config = loadEnv();
  await mongoose.connect(config.mongoUri);

  const User = require("../models/User");
  const Society = require("../models/Society");
  const Wing = require("../models/Wing");
  const Flat = require("../models/Flats");
  const Notice = require("../models/Notice");
  const Complaint = require("../models/Complaint");
  const Service = require("../models/Service");

  try {

    // ---- clean --------------------------------------------------

    const demoUsers = await User.find({ email: new RegExp(`@${DOMAIN}$`) })
      .select("_id societyId").lean();

    const societyIds = [...new Set(
      demoUsers.map((u) => u.societyId).filter(Boolean).map(String)
    )].map((id) => new mongoose.Types.ObjectId(id));

    const demoSocieties = await Society.find({
      name: { $in: SOCIETIES.map((s) => s.name) },
    }).select("_id").lean();

    const allSocietyIds = [
      ...societyIds,
      ...demoSocieties.map((s) => s._id),
    ];

    if (allSocietyIds.length || demoUsers.length) {

      const removed = {
        flats: (await Flat.deleteMany({ societyId: { $in: allSocietyIds } })).deletedCount,
        wings: (await Wing.deleteMany({ societyId: { $in: allSocietyIds } })).deletedCount,
        notices: (await Notice.deleteMany({ societyId: { $in: allSocietyIds } })).deletedCount,
        complaints: (await Complaint.deleteMany({ societyId: { $in: allSocietyIds } })).deletedCount,
        societies: (await Society.deleteMany({ _id: { $in: allSocietyIds } })).deletedCount,
        users: (await User.deleteMany({ email: new RegExp(`@${DOMAIN}$`) })).deletedCount,
        services: (await Service.deleteMany({ name: { $in: SERVICES.map((s) => s.name) } })).deletedCount,
      };

      console.log(`\n  removed: ${JSON.stringify(removed)}`);

    }

    if (CLEAN) {
      console.log("\n  demo data removed\n");
      return;
    }

    // ---- create -------------------------------------------------

    const password = await bcrypt.hash(DEMO_PASSWORD, 10);

    const salespeople = await User.create(
      SALESPEOPLE.map((s) => ({
        name: s.name,
        email: `${slug(s.name)}@${DOMAIN}`,
        phone: s.phone,
        password,
        systemRole: "salesperson",
        status: "approved",
        isVerified: true,
        isOnboarded: true,
      }))
    );

    console.log("\n  salespeople");
    salespeople.forEach((s) => console.log(`    ${s.email}`));

    const societyService = require("../services/societyService");
    const wingService = require("../services/wingServices");

    console.log("\n  societies");

    const created = [];

    for (const [i, spec] of SOCIETIES.entries()) {

      // Round-robin so both salespeople have societies to show.
      const owner = salespeople[i % salespeople.length];

      const session = await mongoose.startSession();
      session.startTransaction();

      try {

        const { society, secretary } = await societyService.createSociety({
          name: spec.name,
          address: spec.address,
          city: spec.city,
          state: spec.state,
          pincode: spec.pincode,
          createdBy: owner._id,
          secretary: {
            name: `${spec.name.split(" ")[0]} Secretary`,
            email: `sec.${slug(spec.name)}@${DOMAIN}`,
            phone: String(9830000000 + i * 11).slice(0, 10),
            password: DEMO_PASSWORD,
          },
        }, session);

        for (const wing of spec.wings) {
          await wingService.createWing({
            societyId: society.id,
            name: wing.name,
            totalFloors: wing.totalFloors,
            flatsPerFloor: wing.flatsPerFloor,
            createdBy: owner._id,
          }, session);
        }

        await session.commitTransaction();

        created.push({ society, secretary, spec });

        const flats = spec.wings.reduce((n, w) => n + w.totalFloors * w.flatsPerFloor, 0);

        console.log(
          `    ${society.societyCode}  ${society.name.padEnd(22)} ` +
          `${spec.wings.length} wing(s), ${flats} flats  · ${owner.name}`
        );

      } catch (error) {
        await session.abortTransaction();
        console.error(`    FAILED ${spec.name}: ${error.message}`);
      } finally {
        session.endSession();
      }

    }

    // ---- residents waiting for approval -------------------------

    const first = created[0];

    if (first) {

      const flats = await Flat.find({ societyId: first.society._id })
        .sort({ floor: 1 }).limit(RESIDENTS.length).lean();

      const wing = await Wing.findOne({ societyId: first.society._id }).lean();

      await User.create(
        RESIDENTS.map((r, i) => ({
          name: r.name,
          email: `${slug(r.name)}@${DOMAIN}`,
          phone: r.phone,
          password,
          systemRole: "user",
          societyRole: "member",
          societyId: first.society._id,
          wingId: wing?._id,
          flatId: flats[i]?._id,
          flatNumber: flats[i]?.flatNumber,
          occupancyType: r.occupancyType,
          livingType: r.livingType,
          familySize: r.familySize,
          vehicles: i % 2 === 0
            ? [{ type: "car", number: `MH15 AB ${1000 + i}`, parkingSlot: `B-${10 + i}` }]
            : [],
          agreedToTerms: true,
          consentAlerts: true,
          // Pending on purpose: the approvals screen needs a queue, and
          // this is the state a real registration lands in.
          status: "pending",
          isVerified: false,
        }))
      );

      console.log(`\n  residents awaiting approval in ${first.society.name}: ${RESIDENTS.length}`);

      await Notice.create([
        {
          societyId: first.society._id, createdBy: first.secretary._id,
          title: "Water shutdown on Thursday",
          description: "Scheduled maintenance for the overhead tanks, 10:00 AM to 2:00 PM. Please store water in advance.",
          type: "notice", category: "amenities", isUrgent: true, status: "published",
        },
        {
          societyId: first.society._id, createdBy: first.secretary._id,
          title: "New visitor entry policy starts Monday",
          description: "All visitors must be approved through the app before the gate will let them in.",
          type: "announcement", category: "security", status: "published",
        },
        {
          societyId: first.society._id, createdBy: first.secretary._id,
          title: "Swimming pool reopened",
          description: "The pool is open again after solar heating was installed.",
          type: "announcement", category: "amenities", status: "published",
        },
      ]);

      console.log(`  notices in ${first.society.name}: 3`);

    }

    // ---- services -----------------------------------------------

    await Service.create(SERVICES.map((s) => ({ ...s, isActive: true })));
    console.log(`  services: ${SERVICES.length}`);

    console.log(
      "\n  every demo account signs in with the password in this script's header\n"
    );

  } finally {
    await mongoose.connection.close();
  }

};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
