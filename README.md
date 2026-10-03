# Residential Society Visitor Management System (Backend)

A REST API built with **Node.js, Express.js, MongoDB Atlas and Mongoose**. Security guards log visitor entries against the resident they are visiting, and residents pre-approve expected visitors and view their own visitor history.

## 1. Problem Statement
A gated residential society wants security guards to log visitor entries against the resident they are visiting, and residents to pre-approve expected visitors. A visitor entry cannot be logged unless a resident exists to approve or be notified of the visit.

## 2. Objectives
- Design Resident, Visitor and VisitorLog schemas using Mongoose.
- Implement CRUD operations for visitor pre-approval by residents.
- Implement visitor entry logging by security guards.
- Implement role-based authorization for guard and resident actions.
- Validate visitor log data before saving.

## 3. Features
- Register / login with **bcrypt**-hashed passwords and **JWT** tokens (payload: `id`, `role`)
- Resident: pre-approve visitors, update/cancel pre-approvals, view **own** visitor history
- Guard: log visitor entry (entry time saved automatically), record exit, look up residents/visitors
- Reusable `authenticate` and `authorize(...roles)` middleware
- Backend validation (required fields, email, phone, ObjectId, resident/visitor must exist)
- Centralized error handling with consistent JSON and correct HTTP status codes
- `helmet` + `cors`, secrets only in `.env`, seed script, automated test script, Postman collection

## 4. Technology Stack
Node.js · Express.js · MongoDB Atlas · Mongoose · jsonwebtoken · bcrypt · dotenv · helmet · cors · nodemon (dev)

## 5. Architecture (MVC style)
```
Client (Postman / React)  ->  Routes  ->  Middleware (authenticate, authorize)  ->  Controller  ->  Model (Mongoose)  ->  MongoDB Atlas
                                                                                         |
                                                                              Error handler (JSON response)
```
- **Routes** map a URL + HTTP method to a controller and list the middleware to run first.
- **Middleware** runs before the controller (checks the token and role).
- **Controllers** hold the logic (validate, query DB, send response).
- **Models** define the MongoDB schemas.

## 6. Database Design
**Resident** (also stores guards; `role` tells them apart)

| Field | Type | Notes |
|---|---|---|
| name | String | required |
| email | String | required, unique, lowercase |
| phone | String | required |
| flatNumber | String | required for residents |
| password | String | bcrypt hash, `select:false` |
| role | String | `resident` or `guard` |

**Visitor**: name, phone (required), email (optional), vehicleNumber (optional), `resident` (ObjectId -> Resident), purpose, expectedDate, isPreApproved. Unique index on (phone, resident).

**VisitorLog**: `resident` (ObjectId -> Resident), `visitor` (ObjectId -> Visitor), entryTime (auto), status (`entered` / `exited` / `denied`), exitTime (optional), loggedBy (ObjectId -> guard).

```
Resident 1 ----< Visitor 1 ----< VisitorLog >---- 1 Resident
```
`populate()` replaces the stored ObjectIds with the real documents when we read logs.

## 7. API Endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | /api/auth/register | public | Register resident (or guard with `guardKey`) |
| POST | /api/auth/login | public | Login, returns JWT |
| POST | /api/visitors/preapprove | resident | Pre-approve a visitor |
| GET | /api/visitors/mine | resident | My pre-approved visitors |
| PUT | /api/visitors/:id | resident (owner) | Update a pre-approval |
| DELETE | /api/visitors/:id | resident (owner) | Cancel a pre-approval |
| GET | /api/visitors?phone= | guard | List visitors |
| POST | /api/visitor-logs | guard | Log a visitor entry |
| GET | /api/visitor-logs | guard | List recent entries |
| PATCH | /api/visitor-logs/:id/exit | guard | Record visitor exit |
| GET | /api/residents?flatNumber= | guard | Find resident ids |
| GET | /api/residents/:id/visitor-logs | resident (own id only) | Own visitor history |

## 8. Authentication Flow
1. User registers -> password hashed with `bcrypt.hash(password, 10)` -> saved.
2. User logs in -> `bcrypt.compare` checks password -> server signs a JWT containing `{ id, role }` with `JWT_SECRET`.
3. Client sends `Authorization: Bearer <token>` on every protected request.
4. `authenticate` middleware verifies the token, loads the user, sets `req.user`. Missing/invalid/expired token -> **401**.

## 9. Authorization Flow
After `authenticate`, `authorize("guard")` (or `"resident"`) checks `req.user.role`. Wrong role -> **403**.
```js
router.post("/", authenticate, authorize("guard"), createVisitorLog);
```
Extra rule: `GET /api/residents/:id/visitor-logs` also requires `:id` to equal the logged-in resident's id, otherwise **403**.

| Action | Resident | Guard |
|---|---|---|
| Pre-approve visitor | yes | 403 |
| Log visitor entry | 403 | yes |
| View own history | yes | 403 |

## 10. Installation & Run
```bash
cd backend
npm install
cp .env.example .env      # then edit .env with your values
npm run seed              # optional: demo data (clears the DB!)
npm run dev               # auto-restart with nodemon   (or: npm start)
```
Server: `http://localhost:5000`

## 11. Environment Variables (`.env`)
| Variable | Meaning |
|---|---|
| PORT | Port for the server (default 5000) |
| MONGO_URI | MongoDB Atlas connection string |
| JWT_SECRET | Long random secret used to sign tokens |
| JWT_EXPIRES_IN | Token lifetime, e.g. `1d` |
| GUARD_REGISTER_KEY | Secret needed to register a guard account |

`.env` is in `.gitignore`; only `.env.example` (no real values) is shared.

## 12. MongoDB Atlas Setup
1. Create a free account at mongodb.com/atlas and create a free **M0 cluster**.
2. **Database Access** -> Add Database User (username + password).
3. **Network Access** -> Add IP Address -> your current IP (or `0.0.0.0/0` for demo only).
4. **Database** -> Connect -> Drivers -> copy the connection string.
5. Put it in `.env` as `MONGO_URI`, replacing `<username>`, `<password>` and adding the database name (`/visitor_management`) before the `?`. Special characters in the password must be URL-encoded.
6. Run `npm start`; you should see `MongoDB connected: ...`.

## 13. Folder Structure
```
backend/
├── src/
│   ├── config/db.js                 # MongoDB connection
│   ├── models/                      # Resident, Visitor, VisitorLog schemas
│   ├── controllers/                 # auth, visitor, visitorLog, resident logic
│   ├── routes/                      # URL -> controller mapping
│   ├── middleware/                  # authMiddleware, roleMiddleware, errorMiddleware
│   ├── utils/                       # AppError, asyncHandler, validators, generateToken
│   ├── seed.js                      # demo data
│   ├── app.js                       # Express setup
│   └── server.js                    # connects DB + starts server
├── tests/run-tests.js               # automated API tests
├── postman/Visitor-Management.postman_collection.json
├── .env.example
└── package.json
```

## 14. How to Test
**Automated:** with the server running, `npm test` runs 60+ checks (success cases, validation, 401/403/404/409).

**Postman / Thunder Client:** import `postman/Visitor-Management.postman_collection.json` and run the requests in order. Tokens and ids are saved automatically as collection variables. Before request **4a**, put your `GUARD_REGISTER_KEY` into its body.

### Manual test guide
Response format is always `{ "success": true|false, "message": "...", "data": ... }`.

**1. Register resident** `POST /api/auth/register`
```json
{ "name": "Aarav Sharma", "email": "aarav@example.com", "phone": "9876543210", "flatNumber": "A-101", "password": "password123" }
```
-> `201` `{ "success": true, "message": "Resident registered successfully", "data": { "id": "...", "role": "resident", ... } }`

**2. Login** `POST /api/auth/login`
```json
{ "email": "aarav@example.com", "password": "password123" }
```
-> `200` `data.token` is the JWT (use as `Authorization: Bearer <token>`).

**3. Pre-approve visitor** `POST /api/visitors/preapprove` (resident token)
```json
{ "name": "Karan Singh", "phone": "9988776655", "vehicleNumber": "MH14CD5678", "purpose": "Meeting", "expectedDate": "2026-10-10" }
```
-> `201` `{ "success": true, "message": "Visitor pre-approved successfully", "data": { "_id": "<visitorId>", "resident": "<residentId>", ... } }`

**4. Register guard** `POST /api/auth/register` then login
```json
{ "name": "Ramesh Guard", "email": "guard@example.com", "phone": "9876543299", "password": "password123", "role": "guard", "guardKey": "<GUARD_REGISTER_KEY>" }
```

**5. Log entry** `POST /api/visitor-logs` (guard token)
```json
{ "residentId": "<residentId>", "visitorId": "<visitorId>" }
```
-> `201` `{ "success": true, "message": "Visitor entry logged successfully", "data": { "status": "entered", "entryTime": "...", "resident": { "name": "...", "flatNumber": "..." }, "visitor": { "name": "..." } } }`

**6. History** `GET /api/residents/<residentId>/visitor-logs` (that resident's token) -> `200` with `count` and populated `data` array.

**7. Invalid resident** - same as test 5 with `"residentId": "64b7f0c2a1b2c3d4e5f60718"` -> `404` `{ "success": false, "message": "Resident not found" }`

**8. Resident tries to log entry** - test 5 with the *resident* token -> `403` `{ "success": false, "message": "Access denied. Only guard can do this" }`

**9. Guard tries pre-approval** - test 3 with the *guard* token -> `403` `{ "success": false, "message": "Access denied. Only resident can do this" }`

**Other errors:** no token `401` · bad ObjectId `400` · missing field `400` · duplicate email `409` · another resident's history `403`.

### Seed data (`npm run seed`)
Password for all: `password123`. Residents `aarav@example.com` (A-101), `priya@example.com` (B-202); guard `guard@example.com`; visitors Rohan Verma (Aarav's), Sneha Iyer (Priya's). The seed script prints the ObjectIds to use.

### HTTP status codes used
200 OK · 201 Created · 400 Bad Request (validation) · 401 Unauthorized (no/invalid token or wrong login) · 403 Forbidden (wrong role / not your data) · 404 Not Found · 409 Conflict (duplicate / has history) · 500 Server Error.

## 15. Viva Cheat-Sheet
- **Node.js**: runs JavaScript on the server. **Express.js**: framework that handles routes and middleware.
- **REST API**: URLs represent resources; HTTP methods (GET/POST/PUT/PATCH/DELETE) are the actions; data is JSON.
- **MongoDB**: NoSQL database storing JSON-like documents in collections. **Atlas**: MongoDB's cloud hosting.
- **Mongoose**: library to model MongoDB data in Node. **Schema**: defines fields/types/rules. **Model**: class built from a schema used to query (`find`, `create`).
- **ObjectId reference**: a field holding another document's `_id` (`ref: "Resident"`) - like a foreign key. **populate()**: replaces that id with the real document at query time.
- **bcrypt**: one-way password hashing with salt; we compare with `bcrypt.compare`, never decrypt.
- **JWT**: signed token `header.payload.signature`; ours carries `id` and `role`; server verifies using `JWT_SECRET`.
- **Middleware**: function `(req, res, next)` that runs between request and controller.
- **Authentication** = who you are (valid token). **Authorization** = what you may do (role check). **RBAC**: permissions based on role.
- **CRUD**: Create (POST), Read (GET), Update (PUT), Delete (DELETE) - done on visitor pre-approvals.
- **Validation**: backend checks (required, email/phone format, ObjectId format, resident/visitor exist) before saving.

## 16. Notes / Limitations
- Guard self-registration is protected by `GUARD_REGISTER_KEY`; in a real society an admin would create guards.
- A guard can only log a visitor that the given resident has pre-approved.
- A basic React frontend is not included; the API is complete and independent.
- Deployment (per the case study): Render/Railway for the backend with `MONGO_URI`, `JWT_SECRET`, `PORT` set as environment variables.
