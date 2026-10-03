// Schema = structure of a document. Model = the object we use to query the collection.
// This one model stores both residents and guards; the "role" field tells them apart.
const mongoose = require("mongoose");

const residentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: [true, "Phone is required"], trim: true },
    // Only residents live in a flat, so guards don't need one
    flatNumber: {
      type: String,
      trim: true,
      required: [
        function () {
          return this.role === "resident";
        },
        "Flat number is required for residents",
      ],
    },
    // select:false => password hash is NOT returned in queries unless we ask for it
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["resident", "guard"], default: "resident" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resident", residentSchema);
