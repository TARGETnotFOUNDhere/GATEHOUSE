// Small reusable validation helpers. All validation happens on the backend.
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// 10 to 13 digits, optional leading + (e.g. 9876543210 or +919876543210)
const isValidPhone = (phone) => /^\+?[0-9]{10,13}$/.test(phone);

// A MongoDB ObjectId is a 24-character hexadecimal string
const isValidObjectId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

// true if value is a non-empty string
const isNonEmpty = (value) => typeof value === "string" && value.trim().length > 0;

module.exports = { isValidEmail, isValidPhone, isValidObjectId, isNonEmpty };
