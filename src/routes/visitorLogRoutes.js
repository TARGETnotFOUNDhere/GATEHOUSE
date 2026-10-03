const express = require("express");
const c = require("../controllers/visitorLogController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const router = express.Router();

router.post("/", authenticate, authorize("guard"), c.createVisitorLog);
router.get("/", authenticate, authorize("guard"), c.getAllLogs);
router.patch("/:id/exit", authenticate, authorize("guard"), c.markExit);

module.exports = router;
