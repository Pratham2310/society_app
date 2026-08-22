const logger = require("../utils/logger");
const mongoose = require("mongoose");

const connectDB = async () => {

    try {

        await mongoose.connect(process.env.MONGO_URI);

        logger.info("MongoDB connected");

    } catch (error) {

        logger.error({ err: error }, "Database connection failed");
        process.exit(1);

    }

};

module.exports = connectDB;