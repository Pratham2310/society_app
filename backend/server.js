require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

// connect database
connectDB();
console.log("MONGO URI:", process.env.MONGO_URI);
// start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});