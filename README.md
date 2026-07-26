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

## 7) Health check

GET /api/auth/health

### Success response

```json
{
  "success": true,
  "message": "Backend service is running."
}
```

---

# Client endpoints

All client routes require authentication and admin access.

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

---

# Caregiver endpoints

All caregiver routes require authentication and admin access except the profile lookup route.

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

# Visit log endpoints

These endpoints support caregiver clock-in and clock-out flow.

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

## 2) Clock in

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

## 3) Clock out

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

---

# Validation notes

- Invalid JSON payloads return a 400 response with a clear message.
- Date fields in the models can store full date-time values.
- Some fields are removed rather than stored as `null` when the business logic requires it, for example client `statusDetails` for active clients.
