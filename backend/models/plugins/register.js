const mongoose = require("mongoose");

const societyScope = require("./societyScope");

// Global plugins only apply to schemas compiled AFTER registration,
// so this must be required before any model. app.js does that first.
mongoose.plugin(societyScope);

module.exports = { societyScope };
