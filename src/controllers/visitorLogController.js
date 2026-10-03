const Resident = require("../models/Resident");
const Visitor = require("../models/Visitor");
const VisitorLog = require("../models/VisitorLog");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { isValidObjectId } = require("../utils/validators");

// POST /api/visitor-logs   (guard only)
const createVisitorLog = asyncHandler(async (req, res) => {
  const { residentId, visitorId, status = "entered" } = req.body;

  // 1. required fields
  if (!residentId) throw new AppError("residentId is required", 400);
  if (!visitorId) throw new AppError("visitorId is required", 400);

  // 2. valid ObjectId format
  if (!isValidObjectId(residentId)) throw new AppError("residentId is not a valid ID", 400);
  if (!isValidObjectId(visitorId)) throw new AppError("visitorId is not a valid ID", 400);

  // 3. status must be allowed when creating a log
  if (!["entered", "denied"].includes(status)) throw new AppError("status must be 'entered' or 'denied'", 400);

  // 4. resident must exist (core rule of the case study)
  const resident = await Resident.findById(residentId);
  if (!resident || resident.role !== "resident") throw new AppError("Resident not found", 404);

  // 5. visitor must exist
  const visitor = await Visitor.findById(visitorId);
  if (!visitor) throw new AppError("Visitor not found", 404);

  // 6. visitor must have been pre-approved by THIS resident
  if (visitor.resident.toString() !== residentId) {
    throw new AppError("This visitor is not pre-approved by the given resident", 400);
  }

  // 7. save (entryTime is filled automatically by the schema default)
  const log = await VisitorLog.create({ resident: residentId, visitor: visitorId, status, loggedBy: req.user.id });
  const populated = await log.populate([
    { path: "resident", select: "name flatNumber phone" },
    { path: "visitor", select: "name phone vehicleNumber" },
  ]);

  res.status(201).json({ success: true, message: "Visitor entry logged successfully", data: populated });
});

// PATCH /api/visitor-logs/:id/exit   (guard only) - visitor leaves
const markExit = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError("Invalid visitor log id", 400);
  const log = await VisitorLog.findById(req.params.id);
  if (!log) throw new AppError("Visitor log not found", 404);
  if (log.status !== "entered") throw new AppError(`Cannot mark exit for a log with status '${log.status}'`, 400);

  log.status = "exited";
  log.exitTime = new Date();
  await log.save();
  res.status(200).json({ success: true, message: "Visitor exit recorded successfully", data: log });
});

// GET /api/visitor-logs   (guard only) - all recent entries
const getAllLogs = asyncHandler(async (req, res) => {
  const logs = await VisitorLog.find()
    .populate("resident", "name flatNumber")
    .populate("visitor", "name phone vehicleNumber")
    .sort({ entryTime: -1 })
    .limit(100);
  res.status(200).json({ success: true, message: "Visitor logs fetched successfully", count: logs.length, data: logs });
});

module.exports = { createVisitorLog, markExit, getAllLogs };
