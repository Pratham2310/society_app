require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const { loadEnv } = require("./config/env");
const sentry = require("./config/sentry");
const logger = require("./utils/logger");

// validate configuration before anything else touches process.env
const config = loadEnv();

//Before anything can throw.
sentry.init();

const app = require("./app");
const connectDB = require("./config/db");

const startServer = async () => {

    await connectDB();

    const server = app.listen(config.port, () => {
        logger.info({ port: config.port, env: config.nodeEnv }, "Server running");
    });

    // graceful shutdown so in-flight requests finish during a deploy
    const shutdown = (signal) => {

        logger.info({ signal }, "Shutting down");

        server.close(async () => {
            //Give Sentry a moment to deliver whatever killed us.
            await sentry.flush(2000);
            await require("mongoose").connection.close(false);
            process.exit(0);
        });

        setTimeout(() => process.exit(1), 10000).unref();

    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

};

startServer();
