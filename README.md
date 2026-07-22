# 🏥 HomeCare Scheduler API Documentation

A RESTful backend API for managing home care scheduling, caregiver and client management, address geocoding, travel time computation, and GPS-verified visit clock-in/clock-out logging.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18+`
- **MongoDB**: Local MongoDB instance or MongoDB Atlas URI
- **Google Maps / Routes API Key** (for travel time computation)

### Environment Variables
Create a `.env` file in the root directory:

```env
PORT=5001
MONGO_URI=mongodb://localhost:27017/homeCare
JWT_SECRET=your_jwt_secret_key_here

# Email / SMTP Settings
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# External APIs
GOOGLE_API_KEY=your_google_routes_api_key
GEOCODE_API_URL=https://nominatim.openstreetmap.org/search
GEOCODE_USER_AGENT=HomeCareScheduler/1.0
```

### Installation & Running Locally

```bash
# Install dependencies
npm install

# Start development server with nodemon
npm run dev

# Run linter
npm run lint
```

---

## 🔐 Authentication & Authorization

Most endpoints require a JSON Web Token (JWT) provided in the request headers:

```http
Authorization: Bearer <your_jwt_token>
```

### Roles
- `admin`: Full access to client management, caregiver management, and administrative reports.
- `caregiver`: Access to assigned daily shifts, visit logging (clock-in / clock-out), and profile retrieval.

---

## 📜 API Endpoint Summary

| Category | Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- | :--- |
| **System** | `GET` | `/` | Public | Service health status (HTML) |
| **Auth** | `POST` | `/api/auth/register/send-code` | Public | Send 6-digit registration verification code to email |
| | `POST` | `/api/auth/register/verify` | Public | Verify code and complete user registration |
| | `POST` | `/api/auth/login` | Public | User login using `fullName` + `employeeCode` |
| | `POST` | `/api/auth/recover/send-code` | Public | Send account recovery code to registered email |
| | `POST` | `/api/auth/recover/verify` | Public | Verify recovery code and retrieve `employeeCode` |
| | `GET` | `/api/auth/me` | Protected | Get profile details of currently logged-in user |
| | `GET` | `/api/auth/health` | Public | Health check JSON endpoint |
| **Caregivers** | `POST` | `/api/caregivers` | Admin | Create a new caregiver profile |
| | `GET` | `/api/caregivers` | Admin | Get list of all caregivers |
| | `GET` | `/api/caregivers/:caregiverId` | Protected | Get caregiver profile by `employeeCode` |
| | `PUT` | `/api/caregivers/:caregiverId` | Admin | Update caregiver profile by `employeeCode` |
| | `DELETE` | `/api/caregivers/:caregiverId` | Admin | Delete caregiver record by `employeeCode` |
| | `POST` | `/api/caregivers/travel` | Protected | Compute travel duration & distance via Google Routes API |
| **Clients** | `GET` | `/api/clients` | Admin | Get list of all clients |
| | `GET` | `/api/clients/:clientId` | Admin | Get specific client details by `clientCode` |
| | `POST` | `/api/clients` | Admin | Create client profile with structured address geocoding |
| | `PUT` | `/api/clients/:clientId` | Admin | Update client profile & geocode updated address |
| | `DELETE` | `/api/clients/:clientId` | Admin | Delete client profile by `clientCode` |
| **Visits** | `GET` | `/api/visits/today-shifts` | Caregiver | Get today's assigned shifts & button status |
| | `POST` | `/api/visits/clock-in` | Caregiver | Clock into scheduled visit with GPS validation |
| | `PUT` | `/api/visits/clock-out` | Caregiver | Clock out of active visit with duration & distance check |
| **Import** | `POST` | `/api/hse-import` | Public | HSE Data Import endpoint (placeholder) |

---

## 📘 Detailed Endpoint Reference

### 1. Authentication (`/api/auth`)

#### 📩 Send Registration Verification Code
* **Endpoint**: `POST /api/auth/register/send-code`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "fullName": "Jane Doe",
    "employeeCode": "CG1001",
    "email": "janedoe@example.com",
    "role": "caregiver"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Verification code sent to your email. Please enter it to complete registration."
  }
  ```

#### ✅ Verify Registration Code
* **Endpoint**: `POST /api/auth/register/verify`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "email": "janedoe@example.com",
    "code": "123456"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Registration complete! You can now log in."
  }
  ```

#### 🔑 Login
* **Endpoint**: `POST /api/auth/login`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "fullName": "Jane Doe",
    "employeeCode": "CG1001",
    "role": "caregiver"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "caregiver",
    "message": "Login successful."
  }
  ```

#### 🔄 Send Recovery Code
* **Endpoint**: `POST /api/auth/recover/send-code`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "email": "janedoe@example.com"
  }
  ```

#### 🔓 Verify Recovery Code
* **Endpoint**: `POST /api/auth/recover/verify`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "email": "janedoe@example.com",
    "code": "654321"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "caregiver",
    "employeeCode": "CG1001",
    "message": "Identity verified. Your employee code has been retrieved."
  }
  ```

#### 👤 Get Current Authenticated User
* **Endpoint**: `GET /api/auth/me`
* **Access**: Protected (`Bearer <token>`)
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "user": {
      "id": "60d5ecb8b5c9c22b8c8e4111",
      "role": "caregiver"
    }
  }
  ```

---

### 2. Caregivers (`/api/caregivers`)

#### ➕ Create Caregiver
* **Endpoint**: `POST /api/caregivers`
* **Access**: Protected (`Admin`)
* **Request Body**:
  ```json
  {
    "userId": "60d5ecb8b5c9c22b8c8e4111",
    "employeeCode": "CG1001",
    "fullName": "Jane Doe",
    "gender": "Female",
    "age": 30,
    "address": {
      "addressLine": "123 Main Street",
      "city": "Dublin",
      "postCode": "D02 X285",
      "latitude": 53.3498,
      "longitude": -6.2603
    },
    "phoneNumber": "+353871234567",
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

#### 📋 Get All Caregivers
* **Endpoint**: `GET /api/caregivers`
* **Access**: Protected (`Admin`)

#### 🔍 Get Caregiver by Employee Code
* **Endpoint**: `GET /api/caregivers/:caregiverId`
* **Access**: Protected

#### ✏️ Update Caregiver Profile
* **Endpoint**: `PUT /api/caregivers/:caregiverId`
* **Access**: Protected (`Admin`)

#### ❌ Delete Caregiver Profile
* **Endpoint**: `DELETE /api/caregivers/:caregiverId`
* **Access**: Protected (`Admin`)

#### 🚗 Compute Travel Time & Distance
* **Endpoint**: `POST /api/caregivers/travel`
* **Access**: Protected
* **Request Body**:
  ```json
  {
    "origin": { "latitude": 53.3498, "longitude": -6.2603 },
    "destination": { "latitude": 53.2985, "longitude": -6.1772 }
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "body": {
      "durationMinutes": 18.5,
      "distanceKM": 12.3,
      "mode": "DRIVE"
    }
  }
  ```

---

### 3. Clients (`/api/clients`)

#### 📋 Get All Clients
* **Endpoint**: `GET /api/clients`
* **Access**: Protected (`Admin`)

#### 🔍 Get Specific Client
* **Endpoint**: `GET /api/clients/:clientId`
* **Access**: Protected (`Admin`)

#### ➕ Create Client Profile (Auto-Geocoded)
* **Endpoint**: `POST /api/clients`
* **Access**: Protected (`Admin`)
* **Request Body**:
  ```json
  {
    "clientCode": "CL2001",
    "fullName": "John Smith",
    "gender": "Male",
    "age": 78,
    "phoneNumber": "+353879876543",
    "address": {
      "addressLine": "45 O'Connell Street",
      "town": "City Centre",
      "city": "Dublin",
      "county": "Dublin",
      "postCode": "D01 Y2A5"
    },
    "hasPets": true,
    "careNeeds": ["Mobility Assistance", "Personal Hygiene"]
  }
  ```

#### ✏️ Update Client Profile
* **Endpoint**: `PUT /api/clients/:clientId`
* **Access**: Protected (`Admin`)

#### ❌ Delete Client Profile
* **Endpoint**: `DELETE /api/clients/:clientId`
* **Access**: Protected (`Admin`)

---

### 4. Visit Logging & Clock In / Out (`/api/visits`)

#### 📅 Get Today's Shifts for Logged-In Caregiver
* **Endpoint**: `GET /api/visits/today-shifts`
* **Access**: Protected (`Caregiver`)
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "scheduleId": "60d5ecb8b5c9c22b8c8e4999",
        "client": {
          "_id": "60d5ecb8b5c9c22b8c8e4888",
          "fullName": "John Smith",
          "clientCode": "CL2001",
          "address": { ... }
        },
        "startTime": "09:00",
        "endTime": "11:00",
        "hasClockedIn": false,
        "hasClockedOut": false,
        "status": null,
        "isClockInTimeEnabled": true,
        "earliestEnabledTimeFormatted": "22/07/2026, 08:40:00"
      }
    ]
  }
  ```

#### ⏰ Clock In
* **Endpoint**: `POST /api/visits/clock-in`
* **Access**: Protected (`Caregiver`)
* **Rules**:
  - Distance between caregiver coordinates and client home must be **<= 200 meters**.
  - Clock-in becomes enabled **20 minutes** prior to shift start time.
  - Clock-in > 20 mins late requires providing a `note`.
* **Request Body**:
  ```json
  {
    "scheduleId": "60d5ecb8b5c9c22b8c8e4999",
    "clientId": "60d5ecb8b5c9c22b8c8e4888",
    "latitude": 53.3498,
    "longitude": -6.2603,
    "note": "Traffic delay due to roadworks"
  }
  ```

#### ⏱️ Clock Out
* **Endpoint**: `PUT /api/visits/clock-out`
* **Access**: Protected (`Caregiver`)
* **Rules**:
  - Distance must be **<= 200 meters** from client location.
  - Calculates total duration in minutes automatically.
  - Early or late clock-out (> 20 mins deviation) flags visit for review and requires a `note`.
* **Request Body**:
  ```json
  {
    "visitId": "60d5ecb8b5c9c22b8c8e4777",
    "clientId": "60d5ecb8b5c9c22b8c8e4888",
    "latitude": 53.3498,
    "longitude": -6.2603,
    "note": "Client requested early wrap-up"
  }
  ```

---

## 🛠️ Project Structure

```text
server/
├── controllers/          # Business logic handlers
│   ├── authController.js
│   ├── caregiverController.js
│   ├── clientController.js
│   └── visitLogController.js
├── middleware/           # Express middlewares
│   ├── authMiddleware.js # JWT verification & role authorization
│   └── logger.js         # ANSI-colored HTTP request & external call logger
├── models/               # Mongoose schema definitions
│   ├── Admin.js
│   ├── Caregiver.js
│   ├── Client.js
│   ├── Schedule.js
│   ├── User.js
│   └── VisitLog.js
├── routes/               # Express route endpoints
│   ├── auth.js
│   ├── caregivers.js
│   ├── clients.js
│   └── visitLogs.js
├── utils/                # Utility helpers & external API connectors
│   ├── calculateTravelTime.js      # Google Routes API integration
│   ├── geoUtils.js                 # Haversine distance calculator
│   ├── geocodeStructuredAddress.js # OpenStreetMap Nominatim geocoder
│   └── sendEmail.js                # Nodemailer SMTP mail service
├── index.js              # Server entry point
└── package.json
```
