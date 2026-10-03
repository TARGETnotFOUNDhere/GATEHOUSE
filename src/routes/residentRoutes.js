const express = require("express");
const c = require("../controllers/residentController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const router = express.Router();

router.get("/", authenticate, authorize("guard"), c.getResidents);
router.get("/:id/visitor-logs", authenticate, authorize("resident"), c.getResidentVisitorLogs);

module.exports = router;
