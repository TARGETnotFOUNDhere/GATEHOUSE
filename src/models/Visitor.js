const mongoose = require("mongoose");

// A visitor pre-approved by a resident.
// "resident" is an ObjectId reference to the Resident who pre-approved this visitor.
const visitorSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Visitor name is required"], trim: true },
    phone: { type: String, required: [true, "Visitor phone is required"], trim: true },
    email: { type: String, trim: true, lowercase: true }, // optional
    vehicleNumber: { type: String, trim: true, uppercase: true }, // optional
    resident: { type: mongoose.Schema.Types.ObjectId, ref: "Resident", required: true },
    // pre-approval information
    purpose: { type: String, trim: true, default: "Visit" },
    expectedDate: { type: Date },
    isPreApproved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// The same phone number can be pre-approved only once per resident
visitorSchema.index({ phone: 1, resident: 1 }, { unique: true });

module.exports = mongoose.model("Visitor", visitorSchema);
