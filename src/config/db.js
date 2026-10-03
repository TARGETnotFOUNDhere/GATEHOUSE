// MongoDB connection using Mongoose.
// Mongoose is an ODM (Object Data Modeling) library: it lets us talk to MongoDB using JavaScript objects.
const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to your .env file.");
  }
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
};

module.exports = connectDB;
