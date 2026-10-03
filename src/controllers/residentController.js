const Resident = require("../models/Resident");
const VisitorLog = require("../models/VisitorLog");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { isValidObjectId } = require("../utils/validators");

// GET /api/residents/:id/visitor-logs   (resident only, own history only)
const getResidentVisitorLogs = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError("Invalid resident id", 400);

  // PRIVACY RULE: a resident may only see their own history
  if (id !== req.user.id) throw new AppError("You can only view your own visitor history", 403);

  const resident = await Resident.findById(id);
  if (!resident) throw new AppError("Resident not found", 404);

  // populate() replaces the stored ObjectIds with the real Visitor / Resident documents
  const logs = await VisitorLog.find({ resident: id })
    .populate("visitor", "name phone email vehicleNumber purpose")
    .populate("resident", "name flatNumber")
    .sort({ entryTime: -1 });

  res.status(200).json({ success: true, message: "Visitor history fetched successfully", count: logs.length, data: logs });
});

// GET /api/residents   (guard only) - helps the guard find a resident's id
const getResidents = asyncHandler(async (req, res) => {
  const filter = { role: "resident" };
  if (req.query.flatNumber) filter.flatNumber = String(req.query.flatNumber);
  const residents = await Resident.find(filter).select("name phone flatNumber");
  res.status(200).json({ success: true, message: "Residents fetched successfully", count: residents.length, data: residents });
});

module.exports = { getResidentVisitorLogs, getResidents };
