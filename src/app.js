// Express app setup: middleware + routes. (server.js starts it.)
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

app.use(helmet({
	contentSecurityPolicy: {
		directives: { imgSrc: ["'self'", "data:", "https://images.unsplash.com"] },
	},
})); // sets secure HTTP headers

// CORS — in production the frontend lives on Vercel; set FRONTEND_URL in Render env vars.
// Locally FRONTEND_URL is unset so we allow all origins (Express default).
const corsOptions = process.env.FRONTEND_URL
	? {
		origin: process.env.FRONTEND_URL.split(',').map((u) => u.trim()), // supports comma-separated list
		credentials: true,
	}
	: {};
app.use(cors(corsOptions));
app.use(express.json()); // parses JSON request bodies into req.body

app.use(express.static(path.join(__dirname, "../public")));
app.get("/api/health", (req, res) => res.json({ success: true, message: "Visitor Management API is running" }));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/visitors", require("./routes/visitorRoutes"));
app.use("/api/visitor-logs", require("./routes/visitorLogRoutes"));
app.use("/api/residents", require("./routes/residentRoutes"));

app.use(notFound); // unknown route -> 404
app.use(errorHandler); // must be LAST

module.exports = app;
