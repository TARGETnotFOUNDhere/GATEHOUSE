// Automated API test. Start the server first (npm start), then run:  npm test
// It creates its own users with random emails, so it works on any database.
require("dotenv").config();
const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
let passed = 0, failed = 0;

const call = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const check = (name, cond, extra = "") => {
  cond ? passed++ : failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${cond ? "" : extra}`);
};
const expect = (name, res, status, success) =>
  check(name, res.status === status && res.body.success === success, `(got ${res.status}: ${JSON.stringify(res.body)})`);

(async () => {
  const id = Date.now();
  const GUARD_KEY = process.env.GUARD_REGISTER_KEY;

  console.log("\n--- Registration & login ---");
  let r = await call("POST", "/api/auth/register", { name: "Res One", email: `r1_${id}@t.com`, phone: "9000000001", flatNumber: "C-1", password: "secret123" });
  expect("Register resident 1 -> 201", r, 201, true);
  check("Password not returned", !JSON.stringify(r.body).includes("secret123") && !r.body.data.password);
  const res1Id = r.body.data.id;
  r = await call("POST", "/api/auth/register", { name: "Res Two", email: `r2_${id}@t.com`, phone: "9000000002", flatNumber: "C-2", password: "secret123" });
  expect("Register resident 2 -> 201", r, 201, true);
  const res2Id = r.body.data.id;
  expect("Duplicate email -> 409", await call("POST", "/api/auth/register", { name: "x", email: `r1_${id}@t.com`, phone: "9000000001", flatNumber: "C-1", password: "secret123" }), 409, false);
  expect("Invalid email -> 400", await call("POST", "/api/auth/register", { name: "x", email: "bad", phone: "9000000001", flatNumber: "C-1", password: "secret123" }), 400, false);
  expect("Invalid phone -> 400", await call("POST", "/api/auth/register", { name: "x", email: `a${id}@t.com`, phone: "123", flatNumber: "C-1", password: "secret123" }), 400, false);
  expect("Missing flat number -> 400", await call("POST", "/api/auth/register", { name: "x", email: `a${id}@t.com`, phone: "9000000001", password: "secret123" }), 400, false);
  expect("Guard register w/o key -> 403", await call("POST", "/api/auth/register", { name: "G", email: `g0_${id}@t.com`, phone: "9000000003", password: "secret123", role: "guard" }), 403, false);
  expect("Guard register with key -> 201", await call("POST", "/api/auth/register", { name: "Guard", email: `g_${id}@t.com`, phone: "9000000003", password: "secret123", role: "guard", guardKey: GUARD_KEY }), 201, true);

  r = await call("POST", "/api/auth/login", { email: `r1_${id}@t.com`, password: "secret123" });
  expect("Login resident 1 -> 200", r, 200, true);
  const t1 = r.body.data.token;
  const payload = JSON.parse(Buffer.from(t1.split(".")[1], "base64").toString());
  check("JWT contains id and role", payload.id === res1Id && payload.role === "resident");
  r = await call("POST", "/api/auth/login", { email: `r2_${id}@t.com`, password: "secret123" });
  const t2 = r.body.data.token;
  r = await call("POST", "/api/auth/login", { email: `g_${id}@t.com`, password: "secret123" });
  expect("Login guard -> 200", r, 200, true);
  const tg = r.body.data.token;
  expect("Wrong password -> 401", await call("POST", "/api/auth/login", { email: `r1_${id}@t.com`, password: "wrong" }), 401, false);
  expect("Unknown email -> 401", await call("POST", "/api/auth/login", { email: `nobody${id}@t.com`, password: "x" }), 401, false);

  console.log("\n--- Pre-approval ---");
  const visitorBody = { name: "Guest A", phone: "9111111111", email: "guest@t.com", vehicleNumber: "mh12xy1", purpose: "Dinner", expectedDate: "2026-10-05" };
  r = await call("POST", "/api/visitors/preapprove", visitorBody, t1);
  expect("Resident pre-approves visitor -> 201", r, 201, true);
  const visitorId = r.body.data._id;
  check("Visitor linked to resident", r.body.data.resident === res1Id);
  expect("Same visitor again -> 200 (find, not duplicate)", await call("POST", "/api/visitors/preapprove", visitorBody, t1), 200, true);
  expect("Pre-approve without token -> 401", await call("POST", "/api/visitors/preapprove", visitorBody), 401, false);
  expect("Pre-approve with garbage token -> 401", await call("POST", "/api/visitors/preapprove", visitorBody, "abc.def.ghi"), 401, false);
  expect("Guard on resident-only endpoint -> 403", await call("POST", "/api/visitors/preapprove", visitorBody, tg), 403, false);
  expect("Missing visitor name -> 400", await call("POST", "/api/visitors/preapprove", { phone: "9111111112" }, t1), 400, false);
  expect("Invalid visitor phone -> 400", await call("POST", "/api/visitors/preapprove", { name: "A", phone: "abc" }, t1), 400, false);
  expect("Invalid visitor email -> 400", await call("POST", "/api/visitors/preapprove", { name: "A", phone: "9111111113", email: "nope" }, t1), 400, false);
  expect("Invalid expectedDate -> 400", await call("POST", "/api/visitors/preapprove", { name: "A", phone: "9111111113", expectedDate: "not-a-date" }, t1), 400, false);

  console.log("\n--- Visitor CRUD ---");
  expect("Resident lists own visitors -> 200", await call("GET", "/api/visitors/mine", null, t1), 200, true);
  expect("Guard lists visitors -> 200", await call("GET", "/api/visitors", null, tg), 200, true);
  expect("Resident cannot list all visitors -> 403", await call("GET", "/api/visitors", null, t1), 403, false);
  expect("Update own visitor -> 200", await call("PUT", `/api/visitors/${visitorId}`, { purpose: "Meeting" }, t1), 200, true);
  expect("Update another resident's visitor -> 403", await call("PUT", `/api/visitors/${visitorId}`, { purpose: "Hack" }, t2), 403, false);
  expect("Bad visitor id -> 400", await call("PUT", "/api/visitors/123", { purpose: "x" }, t1), 400, false);
  r = await call("POST", "/api/visitors/preapprove", { name: "Temp", phone: "9222222222" }, t1);
  expect("Delete own visitor -> 200", await call("DELETE", `/api/visitors/${r.body.data._id}`, null, t1), 200, true);

  console.log("\n--- Visitor entry logging ---");
  const good = { residentId: res1Id, visitorId };
  r = await call("POST", "/api/visitor-logs", good, tg);
  expect("Guard logs entry -> 201", r, 201, true);
  check("entryTime auto-saved + status", !!r.body.data.entryTime && r.body.data.status === "entered");
  check("populate worked (resident name + visitor name)", r.body.data.resident.name === "Res One" && r.body.data.visitor.name === "Guest A");
  const logId = r.body.data._id;
  expect("Resident cannot log entry -> 403", await call("POST", "/api/visitor-logs", good, t1), 403, false);
  expect("No token -> 401", await call("POST", "/api/visitor-logs", good), 401, false);
  expect("Non-existent resident -> 404", await call("POST", "/api/visitor-logs", { residentId: "64b7f0c2a1b2c3d4e5f60718", visitorId }, tg), 404, false);
  check("Non-existent resident message", (await call("POST", "/api/visitor-logs", { residentId: "64b7f0c2a1b2c3d4e5f60718", visitorId }, tg)).body.message === "Resident not found");
  expect("Non-existent visitor -> 404", await call("POST", "/api/visitor-logs", { residentId: res1Id, visitorId: "64b7f0c2a1b2c3d4e5f60718" }, tg), 404, false);
  expect("Invalid residentId format -> 400", await call("POST", "/api/visitor-logs", { residentId: "abc", visitorId }, tg), 400, false);
  expect("Invalid visitorId format -> 400", await call("POST", "/api/visitor-logs", { residentId: res1Id, visitorId: "abc" }, tg), 400, false);
  expect("Missing residentId -> 400", await call("POST", "/api/visitor-logs", { visitorId }, tg), 400, false);
  expect("Missing visitorId -> 400", await call("POST", "/api/visitor-logs", { residentId: res1Id }, tg), 400, false);
  expect("Invalid status -> 400", await call("POST", "/api/visitor-logs", { ...good, status: "bogus" }, tg), 400, false);
  expect("Visitor belongs to other resident -> 400", await call("POST", "/api/visitor-logs", { residentId: res2Id, visitorId }, tg), 400, false);
  expect("Guard id used as resident -> 404", await call("POST", "/api/visitor-logs", { residentId: payload.id === res1Id ? JSON.parse(Buffer.from(tg.split(".")[1], "base64").toString()).id : "", visitorId }, tg), 404, false);
  r = await call("PATCH", `/api/visitor-logs/${logId}/exit`, null, tg);
  expect("Guard records exit -> 200", r, 200, true);
  check("exitTime saved, status exited", !!r.body.data.exitTime && r.body.data.status === "exited");
  expect("Exit twice -> 400", await call("PATCH", `/api/visitor-logs/${logId}/exit`, null, tg), 400, false);
  expect("Resident cannot mark exit -> 403", await call("PATCH", `/api/visitor-logs/${logId}/exit`, null, t1), 403, false);
  expect("Guard lists logs -> 200", await call("GET", "/api/visitor-logs", null, tg), 200, true);
  expect("Delete visitor that has history -> 409", await call("DELETE", `/api/visitors/${visitorId}`, null, t1), 409, false);

  console.log("\n--- Visitor history ---");
  await call("POST", "/api/visitor-logs", good, tg);
  r = await call("GET", `/api/residents/${res1Id}/visitor-logs`, null, t1);
  expect("Resident views own history -> 200", r, 200, true);
  check("History has 2 populated entries", r.body.count === 2 && r.body.data[0].visitor.name === "Guest A");
  expect("Resident 2 views resident 1 history -> 403", await call("GET", `/api/residents/${res1Id}/visitor-logs`, null, t2), 403, false);
  expect("Guard views resident history -> 403", await call("GET", `/api/residents/${res1Id}/visitor-logs`, null, tg), 403, false);
  expect("History without token -> 401", await call("GET", `/api/residents/${res1Id}/visitor-logs`), 401, false);
  expect("History invalid id -> 400", await call("GET", "/api/residents/abc/visitor-logs", null, t1), 400, false);
  r = await call("GET", `/api/residents/${res2Id}/visitor-logs`, null, t2);
  check("Resident 2 history empty", r.status === 200 && r.body.count === 0);
  expect("Guard lists residents -> 200", await call("GET", "/api/residents", null, tg), 200, true);

  console.log("\n--- Misc ---");
  expect("Unknown route -> 404", await call("GET", "/api/nope"), 404, false);
  const bad = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad json" });
  check("Malformed JSON -> 400", bad.status === 400);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
