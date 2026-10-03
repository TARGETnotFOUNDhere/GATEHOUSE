const Resident = require("../models/Resident");
const Visitor = require("../models/Visitor");
const VisitorLog = require("../models/VisitorLog");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { isValidEmail, isValidPhone, isValidObjectId, isNonEmpty } = require("../utils/validators");

// Validates the visitor fields shared by create and update. Returns a clean object.
const validateVisitorBody = (body, { partial = false } = {}) => {
  const { name, phone, email, vehicleNumber, purpose, expectedDate } = body;
  const data = {};

  if (!partial || name !== undefined) {
    if (!isNonEmpty(name)) throw new AppError("Visitor name is required", 400);
    data.name = name;
  }
  if (!partial || phone !== undefined) {
    if (!isNonEmpty(phone) || !isValidPhone(phone)) throw new AppError("A valid visitor phone number is required (10-13 digits)", 400);
    data.phone = phone;
  }
  if (email !== undefined && email !== "") {
    if (!isValidEmail(email)) throw new AppError("Visitor email is not valid", 400);
    data.email = email;
  }
  if (vehicleNumber !== undefined && vehicleNumber !== "") {
    if (!isNonEmpty(vehicleNumber)) throw new AppError("Vehicle number is not valid", 400);
    data.vehicleNumber = vehicleNumber;
  }
  if (purpose !== undefined) {
    if (!isNonEmpty(purpose)) throw new AppError("Purpose must be a non-empty text", 400);
    data.purpose = purpose;
  }
  if (expectedDate !== undefined && expectedDate !== "") {
    if (isNaN(new Date(expectedDate).getTime())) throw new AppError("expectedDate is not a valid date", 400);
    data.expectedDate = new Date(expectedDate);
  }
  return data;
};

// POST /api/visitors/preapprove   (resident only)
const preApproveVisitor = asyncHandler(async (req, res) => {
  // 1. verify the resident exists
  const resident = await Resident.findById(req.user.id);
  if (!resident || resident.role !== "resident") throw new AppError("Resident not found", 404);

  // 2. validate visitor information
  const data = validateVisitorBody(req.body);

  // 3. create/find the visitor (same phone + same resident = same visitor)
  let visitor = await Visitor.findOne({ phone: data.phone, resident: resident._id });
  let statusCode = 201;
  let message = "Visitor pre-approved successfully";

  if (visitor) {
    // already known: update details and approve again
    Object.assign(visitor, data, { isPreApproved: true });
    await visitor.save();
    statusCode = 200;
    message = "Visitor already existed. Pre-approval updated successfully";
  } else {
    // 4. associate the visitor with the resident + store pre-approval info
    visitor = await Visitor.create({ ...data, resident: resident._id, isPreApproved: true });
  }

  res.status(statusCode).json({ success: true, message, data: visitor });
});

// GET /api/visitors/mine   (resident) - visitors I pre-approved
const getMyVisitors = asyncHandler(async (req, res) => {
  const visitors = await Visitor.find({ resident: req.user.id }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, message: "Visitors fetched successfully", count: visitors.length, data: visitors });
});

// GET /api/visitors   (guard) - list visitors with resident info; optional ?phone= and ?residentId=
const getAllVisitors = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.phone) filter.phone = String(req.query.phone).trim();
  if (req.query.residentId) {
    if (!isValidObjectId(req.query.residentId)) throw new AppError("residentId is not a valid ID", 400);
    filter.resident = req.query.residentId;
  }
  const visitors = await Visitor.find(filter)
    .populate("resident", "name flatNumber phone") // replace resident id with selected fields
    .sort({ createdAt: -1 });
  res.status(200).json({ success: true, message: "Visitors fetched successfully", count: visitors.length, data: visitors });
});

// Finds a visitor by :id and makes sure it belongs to the logged-in resident
const findOwnVisitor = async (req) => {
  if (!isValidObjectId(req.params.id)) throw new AppError("Invalid visitor id", 400);
  const visitor = await Visitor.findById(req.params.id);
  if (!visitor) throw new AppError("Visitor not found", 404);
  if (visitor.resident.toString() !== req.user.id) throw new AppError("You can only manage your own visitors", 403);
  return visitor;
};

// PUT /api/visitors/:id   (resident)
const updateVisitor = asyncHandler(async (req, res) => {
  const visitor = await findOwnVisitor(req);
  const data = validateVisitorBody(req.body, { partial: true });
  Object.assign(visitor, data);
  await visitor.save();
  res.status(200).json({ success: true, message: "Visitor updated successfully", data: visitor });
});

// DELETE /api/visitors/:id   (resident) - cancel a pre-approval
const deleteVisitor = asyncHandler(async (req, res) => {
  const visitor = await findOwnVisitor(req);
  // keep history intact: a visitor that already has log entries cannot be deleted
  const hasLogs = await VisitorLog.exists({ visitor: visitor._id });
  if (hasLogs) throw new AppError("Visitor has entry history and cannot be deleted", 409);
  await visitor.deleteOne();
  res.status(200).json({ success: true, message: "Visitor pre-approval deleted successfully", data: {} });
});

module.exports = { preApproveVisitor, getMyVisitors, getAllVisitors, updateVisitor, deleteVisitor };
