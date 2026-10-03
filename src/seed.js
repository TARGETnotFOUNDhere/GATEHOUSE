// Run with:  npm run seed      (WARNING: clears all existing data)
require("dotenv").config();
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Resident = require("./models/Resident");
const Visitor = require("./models/Visitor");
const VisitorLog = require("./models/VisitorLog");

const seed = async () => {
  await connectDB();
  await Promise.all([VisitorLog.deleteMany(), Visitor.deleteMany(), Resident.deleteMany()]);

  const pw = await bcrypt.hash("password123", 10);
  const [r1, r2, guard] = await Resident.create([
    { name: "Aarav Sharma", email: "aarav@example.com", phone: "9876543210", flatNumber: "A-101", password: pw, role: "resident" },
    { name: "Priya Mehta", email: "priya@example.com", phone: "9876543211", flatNumber: "B-202", password: pw, role: "resident" },
    { name: "Ramesh Guard", email: "guard@example.com", phone: "9876543299", password: pw, role: "guard" },
  ]);

  const [v1, v2] = await Visitor.create([
    { name: "Rohan Verma", phone: "9123456780", email: "rohan@example.com", vehicleNumber: "MH12AB1234", resident: r1._id, purpose: "Family visit" },
    { name: "Sneha Iyer", phone: "9123456781", resident: r2._id, purpose: "Delivery" },
  ]);

  await VisitorLog.create({ resident: r1._id, visitor: v1._id, status: "entered", loggedBy: guard._id });

  console.log("Seed complete. All passwords: password123");
  console.log(`Residents: aarav@example.com (${r1._id}), priya@example.com (${r2._id})`);
  console.log(`Guard: guard@example.com (${guard._id})`);
  console.log(`Visitors: ${v1._id} (Aarav's), ${v2._id} (Priya's)`);
  await mongoose.disconnect();
};

seed().catch((e) => { console.error(e); process.exit(1); });
