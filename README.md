# HomeCare Scheduler API

This README documents the current backend API for the HomeCare Scheduler server.

## Base URL

- Local development: http://localhost:5000
- API prefix: /api

## Authentication

Most endpoints require a JWT bearer token.

Header:

```http
Authorization: Bearer <token>
```

The token is issued by the auth endpoints after successful login or recovery verification.

Role-based access:

- **Auth required** — valid JWT bearer token
- **Admin only** — JWT with `admin` role

## Endpoint index

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | Server status page |
| GET | `/api/health/db` | — | MongoDB connectivity check |
| POST | `/api/hse-import` | — | HSE data import (placeholder) |
| POST | `/api/auth/register/send-code` | — | Send registration verification code |
| POST | `/api/auth/register/verify` | — | Complete registration |
| POST | `/api/auth/login` | — | Log in and receive JWT |
| POST | `/api/auth/recover/send-code` | — | Send account recovery code |
| POST | `/api/auth/recover/verify` | — | Verify recovery code and receive JWT |
| GET | `/api/auth/me` | Auth | Get current user |
| GET | `/api/clients` | Admin | List all clients |
| GET | `/api/clients/:clientId` | Auth | Get one client |
| POST | `/api/clients` | Admin | Create a client |
| PUT | `/api/clients/address/:clientId` | Admin | Update client address |
| PUT | `/api/clients/status/:clientId` | Admin | Update client status |
| DELETE | `/api/clients/:clientId` | Admin | Delete a client |
| POST | `/api/clients/careplan/upload/:clientCode` | Admin | Upload care plan file |
| GET | `/api/clients/careplan/download/:clientCode` | Auth | Download care plan file |
| PUT | `/api/clients/careplan/:clientCode` | Admin | Replace care plan file |
| DELETE | `/api/clients/careplan/:clientCode` | Admin | Delete care plan file |
| PUT | `/api/clients/emergencycontact/:clientCode` | Admin | Update emergency contact |
| PUT | `/api/clients/notes/:clientCode` | Admin | Update client notes |
| POST | `/api/caregivers` | Admin | Create a caregiver |
| GET | `/api/caregivers` | Admin | List all caregivers |
| GET | `/api/caregivers/:caregiverId` | Auth | Get one caregiver |
| PUT | `/api/caregivers/:caregiverId` | Admin | Update a caregiver |
| DELETE | `/api/caregivers/:caregiverId` | Admin | Delete a caregiver |
| POST | `/api/caregivers/travel` | Auth | Calculate travel time between coordinates |
| POST | `/api/schedules/assign` | Admin | Assign a shift to a caregiver |
| POST | `/api/schedules/assign-batch` | Admin | Assign multiple shifts to a caregiver |
| POST | `/api/schedules/validate` | Admin | Dry-run validate a single assignment |
| POST | `/api/schedules/validate-batch` | Admin | Dry-run validate a batch assignment |
| GET | `/api/schedules/available-caregivers` | Admin | List eligible caregivers for a slot |
| POST | `/api/schedules/available-caregivers-batch` | Admin | List eligible caregivers across slots |
| GET | `/api/schedules/by-date` | Admin | List schedules by date or date range |
| GET | `/api/schedules/me` | Auth | Get schedules for the logged-in caregiver |
| GET | `/api/schedules/caregiver/:employeeCode` | Admin | Get schedules for a caregiver (employee code) |
| PUT | `/api/schedules/update/:scheduleId` | Admin | Update a schedule |
| PUT | `/api/schedules/:scheduleId/reassign` | Admin | Reassign a schedule to another caregiver |
| POST | `/api/schedules/:scheduleId/cancel` | Admin | Cancel a schedule |
| POST | `/api/leave-requests/create` | Auth | Create a leave request |
| GET | `/api/leave-requests/get` | Admin | List leave requests (optional status filter) |
| GET | `/api/leave-requests/get/:employeeId` | Admin | Get leave requests for an employee |
| GET | `/api/leave-requests/me` | Auth | Get leave requests for the logged-in caregiver |
| PUT | `/api/leave-requests/update/admin` | Admin | Approve or reject a leave request |
| PUT | `/api/leave-requests/update/caregiver` | Auth | Approve or reject a leave request (caregiver) |
| PUT | `/api/leave-requests/update/caregiver/:leaveRequestId` | Auth | Caregiver cancel or update leave dates |
| GET | `/api/leave-requests/check-affected-shifts` | Admin | Shifts overlapping a leave window |
| GET | `/api/visits/today-shifts` | Auth | Get today's shifts for the logged-in caregiver |
| GET | `/api/visits/upcoming-shifts` | Auth | Get upcoming 14-day shifts for the logged-in caregiver |
| POST | `/api/visits/clock-in` | Auth | Clock in to a shift |
| PUT | `/api/visits/clock-out` | Auth | Clock out of a shift |
| GET | `/api/visits/caregivers-with-shift-today` | Admin | List caregivers with a shift today |
| — | `/api/visit-logs/*` | same | Alias of `/api/visits/*` (same router) |
| GET | `/api/uhie/health` | — | Uhie / Foundry chat health |
| POST | `/api/uhie/chat` | Auth | Chat with the Uhie Foundry agent |
| GET | `/api/uhie/tools/caregiver/schedules/:employeeCode` | x-api-key | Caregiver: view own shifts |
| GET | `/api/uhie/tools/caregiver/leave-requests/:employeeCode` | x-api-key | Caregiver: view own leave |
| POST | `/api/uhie/tools/caregiver/leave-requests` | x-api-key | Caregiver: file leave |
| GET | `/api/uhie/tools/admin/schedules/available-caregivers` | x-api-key | Admin: find suitable caregivers |
| POST | `/api/uhie/tools/admin/schedules/validate` | x-api-key | Admin: validate assignment |
| POST | `/api/uhie/tools/admin/schedules/assign` | x-api-key | Admin: assign shift |
| PUT | `/api/uhie/tools/admin/schedules/:scheduleId/reassign` | x-api-key | Admin: reassign shift |
| GET | `/api/uhie/tools/admin/leave-requests/pending` | x-api-key | Admin: pending leave list |

## Common response format

Success responses usually look like this:

```json
{
  "success": true,
  "message": "...",
  "data": { }
}
```

Error responses usually look like this:

```json
{
  "success": false,
  "message": "..."
}
```

---

# Root endpoints

## 1) Server status page

GET /

Returns a simple HTML status page confirming the API is online.

## 2) HSE data import

POST /api/hse-import

Placeholder endpoint for future HSE data import.

### Success response

```json
{
  "success": true,
  "message": "HSE import endpoint ready"
}
```

## 3) Database health check

GET /api/health/db

Confirms MongoDB is reachable (useful after deploy). Uses the `ensureDb` middleware.

### Success response

```json
{
  "success": true,
  "message": "MongoDB connected",
  "readyState": 1
}
```

---

# Auth endpoints

## 1) Send registration code

POST /api/auth/register/send-code

### Request body

```json
{
  "fullName": "Jane Smith",
  "employeeCode": "EMP1001",
  "email": "jane@example.com",
  "role": "caregiver"
}
```

### Allowed values

- role: `caregiver` or `admin`

### Success response

```json
{
  "success": true,
  "message": "Verification code sent to your email. Please enter it to complete registration."
}
```

### Status codes

- 200: verification code sent
- 400: invalid role, employee record mismatch, email already registered, or code already linked
- 500: server error

## 2) Verify registration code

POST /api/auth/register/verify

### Request body

```json
{
  "email": "jane@example.com",
  "code": "123456"
}
```

### Success response

```json
{
  "success": true,
  "message": "Registration complete! You can now log in."
}
```

## 3) Login

POST /api/auth/login

### Request body

```json
{
  "fullName": "Jane Smith",
  "employeeCode": "EMP1001",
  "role": "caregiver"
}
```

### Success response

```json
{
  "success": true,
  "token": "<jwt-token>",
  "role": "caregiver",
  "message": "Login successful."
}
```

### Status codes

- 200: success
- 401: invalid name/employee code or no registered account

## 4) Send recovery code

POST /api/auth/recover/send-code

### Request body

```json
{
  "email": "jane@example.com"
}
```

## 5) Verify recovery code

POST /api/auth/recover/verify

### Request body

```json
{
  "email": "jane@example.com",
  "code": "123456"
}
```

### Success response

```json
{
  "success": true,
  "token": "<jwt-token>",
  "role": "caregiver",
  "employeeCode": "EMP1001",
  "message": "Identity verified. Your employee code has been retrieved."
}
```

## 6) Get current user

GET /api/auth/me

Requires authentication.

### Success response

```json
{
  "success": true,
  "user": {
    "id": "...",
    "role": "caregiver"
  }
}
```

---

# Client endpoints

Most client routes require authentication and admin access. The exceptions are `GET /api/clients/:clientId` and `GET /api/clients/careplan/download/:clientCode`, which require authentication only.

## 1) Get all clients

GET /api/clients

### Success response

```json
{
  "success": true,
  "body": [
    {
      "_id": "...",
      "clientCode": "CL001",
      "fullName": "John Doe",
      "status": "active"
    }
  ]
}
```

## 2) Get one client

GET /api/clients/:clientId

Example:

```http
GET /api/clients/CL001
```

## 3) Create a client

POST /api/clients

### Request body

```json
{
  "clientCode": "CL001",
  "fullName": "John Doe",
  "gender": "Male",
  "age": 78,
  "address": {
    "addressLine": "10 Main Street",
    "town": "Dublin",
    "city": "Dublin",
    "county": "Dublin",
    "postCode": "D01 ABC1"
  },
  "phoneNumber": "0851234567",
  "hasPets": false,
  "careNeeds": ["Medication support"],
  "emergencyContact": {
    "name": "Mary Doe",
    "relationship": "Daughter",
    "phoneNumber": "0877654321"
  },
  "notes": "Prefers morning visits",
  "status": "active"
}
```

### Success response

```json
{
  "success": true,
  "message": "Client record created successfully",
  "data": {
    "clientCode": "CL001",
    "fullName": "John Doe"
  }
}
```

### Allowed values

- gender: `Female`, `Male`, `Other`
- status: `active`, `inactive`, `deceased`, `other`

## 4) Update client address

PUT /api/clients/address/:clientId

### Example request

```json
{
  "addressLine": "10 Main Street",
  "town": "Dublin",
  "city": "Dublin",
  "county": "Dublin",
  "postCode": "D01 ABC1"
}
```

The server re-geocodes the address and updates the stored coordinates.

## 5) Update client status

PUT /api/clients/status/:clientId

### Request body

```json
{
  "status": "inactive",
  "inactiveReason": "hospitalised",
  "statusNotes": "Client is currently in hospital"
}
```

### Allowed values

- status: `active`, `inactive`, `deceased`, `other`
- inactiveReason: `hospitalised`, `temporary-service-paused`, `termination-of-service`, `family-request`, `other`, `None`

### Special rules

- For `active`: the server removes the `statusDetails` field from the document.
- For `inactive` or `other`: `inactiveReason` and `statusNotes` are required.
- For `deceased`: `dateOfDeath`, `causeOfDeath`, and `timeOfDeath` are required.

### Example: deceased status

```json
{
  "status": "deceased",
  "dateOfDeath": "2025-01-15",
  "causeOfDeath": "Illness",
  "timeOfDeath": "14:30"
}
```

## 6) Delete a client

DELETE /api/clients/:clientId

### Success response

```json
{
  "success": true,
  "message": "Client CL001 has been removed from the database."
}
```

## 7) Upload care plan

POST /api/clients/careplan/upload/:clientCode

Requires admin access. Accepts a multipart form upload with a single `file` field.

Example:

```http
POST /api/clients/careplan/upload/CL001
Content-Type: multipart/form-data
```

### Success response

```json
{
  "success": true,
  "message": "Care plan file uploaded successfully.",
  "data": {
    "clientCode": "CL001",
    "carePlan": {
      "filePath": "...",
      "storedFilename": "...",
      "mimeType": "application/pdf",
      "uploadedAt": "2025-01-15T10:00:00.000Z"
    }
  }
}
```

### Notes

- Returns 400 if the client already has a care plan file. Delete the existing file before uploading a new one.

## 8) Download care plan

GET /api/clients/careplan/download/:clientCode

Requires authentication.

Returns the care plan file as a binary download with appropriate `Content-Disposition` and `Content-Type` headers.

## 9) Replace care plan

PUT /api/clients/careplan/:clientCode

Requires admin access. Accepts a multipart form upload with a single `file` field. Replaces an existing care plan file.

## 10) Delete care plan

DELETE /api/clients/careplan/:clientCode

Requires admin access. Deletes the care plan file from storage and removes the reference from the client record.

### Success response

```json
{
  "success": true,
  "message": "Care plan file deleted successfully.",
  "data": {
    "clientCode": "CL001",
    "carePlanFile": null
  }
}
```

## 11) Update emergency contact

PUT /api/clients/emergencycontact/:clientCode

Requires admin access.

### Request body

```json
{
  "name": "Mary Doe",
  "phoneNumber": "0877654321",
  "relationship": "Daughter"
}
```

### Success response

```json
{
  "success": true,
  "message": "Emergency contact updated successfully.",
  "data": {
    "clientCode": "CL001",
    "emergencyContact": {
      "name": "Mary Doe",
      "phoneNumber": "0877654321",
      "relationship": "Daughter"
    }
  }
}
```

## 12) Update client notes

PUT /api/clients/notes/:clientCode

Requires admin access.

### Request body

```json
{
  "notes": "Prefers morning visits"
}
```

### Success response

```json
{
  "success": true,
  "message": "Note updated successfully.",
  "data": {
    "clientCode": "CL001",
    "notes": "Prefers morning visits"
  }
}
```

---

# Caregiver endpoints

Most caregiver routes require authentication and admin access. The exceptions are `GET /api/caregivers/:caregiverId` and `POST /api/caregivers/travel`, which require authentication only.

## 1) Create a caregiver

POST /api/caregivers

### Example request

```json
{
  "userId": "<user-object-id>",
  "employeeCode": "EMP2002",
  "fullName": "Sarah Brown",
  "gender": "Female",
  "age": 32,
  "address": {
    "addressLine": "25 Oak Road",
    "town": "Cork",
    "city": "Cork",
    "county": "Cork",
    "postCode": "T12 3456"
  },
  "phoneNumber": "0871234567",
  "hasPetAllergy": false,
  "skills": ["Dementia Care", "Palliative Care"],
  "availability": [
    {
      "day": "Monday",
      "startTime": "08:00",
      "endTime": "16:00"
    }
  ],
  "status": "active"
}
```

### Allowed values

- gender: `Female`, `Male`, `Other`
- status: `active`, `on-leave`
- availability day: `Monday` to `Sunday`

## 2) Get all caregivers

GET /api/caregivers

## 3) Get one caregiver

GET /api/caregivers/:caregiverId

Example:

```http
GET /api/caregivers/EMP2002
```

## 4) Update a caregiver

PUT /api/caregivers/:caregiverId

## 5) Delete a caregiver

DELETE /api/caregivers/:caregiverId

## 6) Travel time calculation

POST /api/caregivers/travel

### Request body

```json
{
  "origin": { "latitude": 53.3498, "longitude": -6.2603 },
  "destination": { "latitude": 53.344, "longitude": -6.2672 }
}
```

### Success response

```json
{
  "success": true,
  "body": {
    "duration": 5,
    "distance": 1200
  }
}
```

---

# Schedule endpoints

## 1) Assign a schedule

POST /api/schedules/assign

Requires admin access.

### Request body

```json
{
  "clientCode": "CL001",
  "employeeCode": "EMP2002",
  "date": "2025-03-15",
  "startTime": "08:00",
  "endTime": "16:00"
}
```

### Success response

```json
{
  "success": true,
  "message": "Schedule assigned successfully.",
  "data": {
    "_id": "...",
    "client": "...",
    "caregiver": "...",
    "date": "2025-03-15T00:00:00.000Z",
    "startTime": "08:00",
    "endTime": "16:00",
    "status": "scheduled"
  }
}
```

### Status codes

- 201: schedule created
- 400: client or caregiver is not active
- 404: client or caregiver not found

## 2) Assign schedules in batch

POST /api/schedules/assign-batch

Requires admin access.

### Request body

```json
{
  "clientCode": "CL001",
  "employeeCode": "EMP2002",
  "slots": [
    { "date": "2025-03-15", "startTime": "08:00", "endTime": "10:00" },
    { "date": "2025-03-16", "startTime": "08:00", "endTime": "10:00" }
  ],
  "notes": "Optional"
}
```

## 3) Validate assignment (dry-run)

POST /api/schedules/validate

Requires admin access. Same body fields as assign (`clientCode`, `employeeCode`, `date`, `startTime`, `endTime`). Does not create a schedule.

## 4) Validate batch assignment (dry-run)

POST /api/schedules/validate-batch

Requires admin access. Body: `clientCode`, `employeeCode`, `slots`.

## 5) Available caregivers for a slot

GET /api/schedules/available-caregivers

Requires admin access.

Query: `clientCode`, `date`, `startTime`, `endTime`.

## 6) Available caregivers for multiple slots

POST /api/schedules/available-caregivers-batch

Requires admin access. Body: `clientCode`, `slots`.

## 7) Schedules by date

GET /api/schedules/by-date

Requires admin access.

Query: `date`, or `start` and `end` for a range.

## 8) Get my schedules

GET /api/schedules/me

Requires authentication. Returns schedules for the logged-in caregiver.

### Success response

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "client": {
        "name": "John Doe",
        "clientCode": "CL001"
      },
      "date": "2025-03-15T00:00:00.000Z",
      "startTime": "08:00",
      "endTime": "16:00",
      "status": "scheduled"
    }
  ]
}
```

## 9) Get schedules for a caregiver

GET /api/schedules/caregiver/:employeeCode

Requires admin access. The path parameter is the caregiver's employee code. Optional query: `date`.

Example:

```http
GET /api/schedules/caregiver/EMP2002
```

## 10) Update a schedule

PUT /api/schedules/update/:scheduleId

Requires admin access.

### Request body

```json
{
  "date": "2025-03-16",
  "startTime": "09:00",
  "endTime": "17:00",
  "caregiver": "<caregiver-object-id>",
  "employeeCode": "EMP2002",
  "status": "scheduled",
  "notes": "Optional"
}
```

### Allowed values

- status: `scheduled`, `in-progress`, `completed`, `cancelled`

### Success response

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "date": "2025-03-16T00:00:00.000Z",
    "startTime": "09:00",
    "endTime": "17:00",
    "status": "scheduled"
  }
}
```

## 11) Reassign a schedule

PUT /api/schedules/:scheduleId/reassign

Requires admin access.

### Request body

```json
{
  "employeeCode": "EMP2003"
}
```

## 12) Cancel a schedule

POST /api/schedules/:scheduleId/cancel

Requires admin access. Cancels the schedule identified by `:scheduleId`.

---

# Leave request endpoints

## 1) Create a leave request

POST /api/leave-requests/create

Requires authentication.

### Request body

```json
{
  "employeeCode": "EMP2002",
  "leaveType": "vacation",
  "startDate": "2025-04-01",
  "endDate": "2025-04-07",
  "reason": "Family holiday"
}
```

### Allowed values

- leaveType: `sick`, `vacation`, `emergency`
- status (set by server): `pending`, `approved`, `rejected`, `cancelled`

### Business rules

- Vacation leave must be submitted at least 2 weeks in advance.
- Sick, emergency, and other leave types require a non-empty `reason`.
- Overlapping leave requests for the same employee are rejected.

### Success response

```json
{
  "success": true,
  "message": "Leave request created successfully.",
  "data": {
    "employeeCode": "EMP2002",
    "leaveType": "vacation",
    "startDate": "2025-04-01T00:00:00.000Z",
    "endDate": "2025-04-07T00:00:00.000Z",
    "reason": "Family holiday",
    "status": "pending"
  }
}
```

## 2) Get all leave requests (admin)

GET /api/leave-requests/get

Requires admin access. Optionally filter by status using a query parameter.

Example:

```http
GET /api/leave-requests/get?status=pending
```

### Allowed query values

- status: `pending`, `approved`, `rejected`

## 3) Get leave requests by employee

GET /api/leave-requests/get/:employeeId

Requires admin access. Returns all leave requests for the given employee code.

Example:

```http
GET /api/leave-requests/get/EMP2002
```

## 4) Get my leave requests

GET /api/leave-requests/me

Requires authentication. Returns leave requests for the logged-in caregiver.

### Success response

```json
{
  "success": true,
  "data": [
    {
      "employeeCode": "EMP2002",
      "leaveType": "vacation",
      "startDate": "2025-04-01T00:00:00.000Z",
      "endDate": "2025-04-07T00:00:00.000Z",
      "reason": "Family holiday",
      "status": "pending"
    }
  ]
}
```

## 5) Update leave request status (admin)

PUT /api/leave-requests/update/admin

Requires admin access.

### Request body

```json
{
  "leaveRequestId": "<leave-request-object-id>",
  "status": "approved",
  "adminNotes": "Approved for the requested dates."
}
```

### Allowed values

- status: `approved`, `rejected`

### Success response

```json
{
  "success": true,
  "message": "Leave request approved successfully.",
  "data": {
    "status": "approved",
    "adminNotes": "Approved for the requested dates."
  }
}
```

## 6) Update leave request status (caregiver)

PUT /api/leave-requests/update/caregiver

Requires authentication.

Uses the same request body and response format as the admin update endpoint.

## 7) Caregiver cancel or update leave dates

PUT /api/leave-requests/update/caregiver/:leaveRequestId

Requires authentication.

Query: `type` (action type). Body may include `caregiverCode`, `startDate`, `endDate`.

## 8) Check affected shifts

GET /api/leave-requests/check-affected-shifts

Requires admin access. Returns shifts that overlap a leave window.

Query: `employeeCode`, `startDate`, `endDate`.

---

# Visit log endpoints

These endpoints support caregiver clock-in and clock-out flow. The same router is mounted at both `/api/visits` and `/api/visit-logs` (paths below use `/api/visits`).

## 1) Get today’s shifts

GET /api/visits/today-shifts

Requires authentication.

### Success response

```json
{
  "success": true,
  "body": [
    {
      "scheduleId": "...",
      "client": {
        "fullName": "John Doe",
        "clientCode": "CL001"
      },
      "startTime": "08:00",
      "endTime": "16:00",
      "hasClockedIn": false,
      "hasClockedOut": false,
      "status": null
    }
  ]
}
```

## 2) Get upcoming 14-day shifts

GET /api/visits/upcoming-shifts

Requires authentication. Returns shifts for today and the following 13 days for the logged-in caregiver. Completed (clocked-out) shifts are excluded from the response.

### Success response

```json
{
  "success": true,
  "body": [
    {
      "scheduleId": "...",
      "client": {
        "fullName": "John Doe",
        "clientCode": "CL001",
        "address": { },
        "notes": "Prefers morning visits",
        "carePlan": { }
      },
      "date": "2025-03-15T00:00:00.000Z",
      "startTime": "08:00",
      "endTime": "16:00",
      "hasClockedIn": false,
      "hasClockedOut": false,
      "status": null,
      "visitLogId": null,
      "isClockInTimeEnabled": false,
      "earliestEnabledTimeFormatted": "15/03/2025, 07:40:00"
    }
  ]
}
```

## 3) Clock in

POST /api/visits/clock-in

### Request body

```json
{
  "scheduleId": "<schedule-object-id>",
  "clientId": "<client-object-id>",
  "latitude": 53.3498,
  "longitude": -6.2603,
  "note": "Running late"
}
```

### Success response

```json
{
  "success": true,
  "data": {
    "status": "in-progress"
  }
}
```

### Notes

- The server checks the shift assignment, the selected client, the date, the 20-minute early clock-in window, and the 200m location rule.
- If the caregiver clocks in late without a note, the request is rejected.

## 4) Clock out

PUT /api/visits/clock-out

### Request body

```json
{
  "visitId": "<visit-log-object-id>",
  "clientId": "<client-object-id>",
  "latitude": 53.3498,
  "longitude": -6.2603,
  "note": "Completed visit"
}
```

### Success response

```json
{
  "success": true,
  "data": {
    "status": "completed"
  }
}
```

### Notes

- The server validates the caregiver’s ownership of the visit and the 200m location rule.
- Early or late clock-out without a note may be rejected.

## 5) Caregivers with a shift today

GET /api/visits/caregivers-with-shift-today

Requires admin access. Returns caregivers who have at least one shift scheduled for today.

---

# Uhie chat endpoints

Chat with the Microsoft Foundry agent (Uhie). Requires `FOUNDRY_ENDPOINT` and `FOUNDRY_AGENT_NAME` in the server environment.

| Variable | Description |
|----------|-------------|
| `FOUNDRY_ENDPOINT` | Foundry **project** endpoint, e.g. `https://<resource>.services.ai.azure.com/api/projects/<project-name>` |
| `FOUNDRY_AGENT_NAME` | Name of the agent in that project |
| `FOUNDRY_TOOL_API_KEY` | Static key for **`/api/uhie/tools/*` only** (Foundry OpenAPI). Existing APIs stay Bearer JWT. |

Auth to Foundry uses `DefaultAzureCredential` (Azure CLI / managed identity / env credentials on the host).

## Foundry tools (isolated x-api-key)

These routes are for the Foundry agent OpenAPI connector only. They do **not** accept Bearer JWT, and normal `/api/schedules` / `/api/leave-requests` routes do **not** accept `x-api-key`.

OpenAPI spec for Foundry: `docs/foundry-openapi-connector.json`

Tool routes always return **HTTP 200** (Foundry fails on 404/400/500). Check `success` and `data` in the JSON body.

Pass **`actingRole`** and **`actingEmployeeCode`** from signed-in chat context on every tool call (query for GET, body for POST/PUT). Caregiver tools reject mismatched `employeeCode`; admin tools require a registered admin profile.

### Caregiver tools (`actingRole=caregiver`)

| Method | Path |
|--------|------|
| GET | `/api/uhie/tools/caregiver/schedules/:employeeCode?actingRole=caregiver&actingEmployeeCode=` |
| GET | `/api/uhie/tools/caregiver/leave-requests/:employeeCode?actingRole=caregiver&actingEmployeeCode=` |
| POST | `/api/uhie/tools/caregiver/leave-requests` |

Legacy paths `/api/uhie/tools/schedules/*` and `/api/uhie/tools/leave-requests` still work with the same caregiver role checks.

### Admin tools (`actingRole=admin`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/uhie/tools/admin/schedules/available-caregivers?clientCode=&date=&startTime=&endTime=` | Find suitable caregivers for a shift |
| POST | `/api/uhie/tools/admin/schedules/validate` | Optional: validate before assign |
| POST | `/api/uhie/tools/admin/schedules/assign` | Add schedule after admin confirms |
| PUT | `/api/uhie/tools/admin/schedules/:scheduleId/reassign` | Reassign shift to another caregiver |
| GET | `/api/uhie/tools/admin/leave-requests/pending` | List pending leave requests |

Admin scheduling flow: **findAvailableCaregivers** → (optional **validateScheduleAssignment**) → **assignSchedule**.

POST body example:

```json
{
  "employeeCode": "CG001",
  "leaveType": "sick",
  "startDate": "2026-08-28",
  "endDate": "2026-08-29",
  "reason": "Flu"
}
```

## 1) Health check

GET /api/uhie/health

Optional query: `?deep=1` (or `true`) — also calls Foundry to resolve the agent.

### Success response

```json
{
  "success": true,
  "status": "ok",
  "service": "uhie-chat",
  "foundryConfigured": true,
  "agentName": "Uhie",
  "timestamp": "2026-08-26T17:00:00.000Z"
}
```

With `deep=1`, an `agent` object may be included (`name`, `version`). If Foundry is missing or unreachable, the response uses `status: "degraded"` and HTTP 503.

## 2) Chat

POST /api/uhie/chat

Requires authentication.

### Request body

```json
{
  "message": "How do I request sick leave?",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello — how can I help?" }
  ],
  "user": {
    "fullName": "Joel Montuya",
    "employeeCode": "EMP001",
    "role": "caregiver"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `message` | Yes | Current user message |
| `history` | No | Recent turns (`role` + `content` / `text` / `message`). Last 12 are sent to the agent |
| `user` | No | Signed-in context for the agent. If omitted, values are taken from the JWT (`fullName`, `employeeCode`, `role`) when present |

### Success response

```json
{
  "success": true,
  "response": "You can report and request sick leave like this:\n\n1. Phone the roster/office...\n2. Submit a sick leave request in the app...",
  "references": {
    "1": "HR Leave Balances Policy",
    "2": "HR Onboarding Guide"
  }
}
```

| Field | Description |
|-------|-------------|
| `response` | Assistant answer with Foundry citation markers removed (no inline `[1]` / `【…†source】`) |
| `references` | Map of `"1"`, `"2"`, … to knowledge-base document titles/filenames used for the answer. Azure internal labels such as `Answersynthesis` are omitted |

The frontend can render `references` as a sources list (e.g. `[1] HR Leave Balances Policy`).

### Error responses

```json
{ "success": false, "message": "Message is required" }
```

```json
{
  "success": false,
  "message": "Foundry is not configured. Set FOUNDRY_ENDPOINT and FOUNDRY_AGENT_NAME."
}
```

HTTP 500 if the Foundry call fails (`message` contains the error detail).

---

# Validation notes

- Invalid JSON payloads return a 400 response with a clear message.
- Date fields in the models can store full date-time values.
- Some fields are removed rather than stored as `null` when the business logic requires it, for example client `statusDetails` for active clients.
