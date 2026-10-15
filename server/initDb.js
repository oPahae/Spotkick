require("dotenv").config();
const db = require("./db");

db.initSchema()
  .then(() => {
    console.log("Database and tables are ready.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Database initialization failed:", err.message);
    process.exit(1);
  });
