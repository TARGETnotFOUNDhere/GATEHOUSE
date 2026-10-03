const mongoose = require("mongoose");

// One record per visitor entry, written by a guard.
// resident & visitor are ObjectId references -> we use populate() to replace the ids with full documents.
const visitorLogSchema = new mongoose.Schema(
  {
    resident: { type: mongoose.Schema.Types.ObjectId, ref: "Resident", required: true },
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: "Visitor", required: true },
    entryTime: { type: Date, default: Date.now }, // saved automatically
    exitTime: { type: Date }, // optional, set when visitor leaves
    status: { type: String, enum: ["entered", "exited", "denied"], default: "entered" },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Resident" }, // the guard
  },
  { timestamps: true }
);

module.exports = mongoose.model("VisitorLog", visitorLogSchema);
