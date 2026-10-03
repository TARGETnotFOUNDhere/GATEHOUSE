const express = require("express");
const c = require("../controllers/visitorController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const router = express.Router();

// Every route: first authenticate (valid token?), then authorize (right role?)
router.post("/preapprove", authenticate, authorize("resident"), c.preApproveVisitor);
router.get("/mine", authenticate, authorize("resident"), c.getMyVisitors);
router.get("/", authenticate, authorize("guard"), c.getAllVisitors);
router.put("/:id", authenticate, authorize("resident"), c.updateVisitor);
router.delete("/:id", authenticate, authorize("resident"), c.deleteVisitor);

module.exports = router;
