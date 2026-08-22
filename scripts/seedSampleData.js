/**
 * Populate Atlas with additional sample data for dev/demo.
 * Safe to re-run: skips records that already exist (by unique codes/emails).
 * Usage: node scripts/seedSampleData.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const User = require("../models/User");
const Caregiver = require("../models/Caregiver");
const Client = require("../models/Client");
const Schedule = require("../models/Schedule");
const VisitLog = require("../models/VisitLog");
const LeaveRequests = require("../models/LeaveRequests");
const Admin = require("../models/Admin");

const ADMIN_USER_ID = "6a6e703b251d93065220e6eb"; // Joel Montuya admin login

function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function shiftDateTime(day, timeStr) {
    const [h, m, s = 0] = timeStr.split(":").map(Number);
    const d = new Date(day);
    d.setHours(h, m, s, 0);
    return d;
}

async function ensureCaregiverWithUser({ email, employeeCode, profile }) {
    let user = await User.findOne({ email });
    if (!user) {
        user = await User.create({
            email,
            role: "caregiver",
            isEmailVerified: true,
        });
        console.log(`  + User ${email}`);
    }

    let caregiver = await Caregiver.findOne({ employeeCode });
    if (!caregiver) {
        caregiver = await Caregiver.create({
            ...profile,
            userId: user._id,
            employeeCode,
        });
        console.log(`  + Caregiver ${employeeCode} ${profile.fullName}`);
    }

    if (user.caregiverId?.toString() !== caregiver._id.toString()) {
        user.caregiverId = caregiver._id;
        await user.save();
        console.log(`  ~ Linked ${email} -> ${employeeCode}`);
    }

    if (caregiver.userId?.toString() !== user._id.toString()) {
        caregiver.userId = user._id;
        await caregiver.save();
    }

    return caregiver;
}

async function ensureClient(data) {
    const existing = await Client.findOne({ clientCode: data.clientCode });
    if (existing) {
        console.log(`  = Client ${data.clientCode} already exists`);
        return existing;
    }
    const client = await Client.create(data);
    console.log(`  + Client ${data.clientCode} ${data.fullName}`);
    return client;
}

async function ensureSchedule(data) {
    const existing = await Schedule.findOne({
        caregiver: data.caregiver,
        client: data.client,
        date: data.date,
        startTime: data.startTime,
    });
    if (existing) return existing;

    const schedule = await Schedule.create(data);
    console.log(`  + Schedule ${data.startTime}-${data.endTime} on ${data.date.toISOString().slice(0, 10)}`);
    return schedule;
}

async function ensureVisitLog(data) {
    const existing = await VisitLog.findOne({ schedule: data.schedule });
    if (existing) return existing;

    const log = await VisitLog.create(data);
    console.log(`  + VisitLog ${data.status} for schedule ${data.schedule}`);
    return log;
}

async function ensureLeaveRequest(data) {
    const existing = await LeaveRequests.findOne({
        employeeCode: data.employeeCode,
        startDate: data.startDate,
        endDate: data.endDate,
    });
    if (existing) return existing;

    const req = await LeaveRequests.create(data);
    console.log(`  + Leave ${data.leaveType} (${data.status}) for ${data.employeeCode}`);
    return req;
}

async function fixExistingLinks() {
    console.log("\nFixing existing links...");

    const joelCaregiverUser = await User.findOne({ email: "montuyajoel2123@gmail.com" });
    const joelCaregiver = await Caregiver.findOne({ employeeCode: "EMP008" });
    if (joelCaregiverUser && joelCaregiver && joelCaregiverUser.caregiverId?.toString() !== joelCaregiver._id.toString()) {
        joelCaregiverUser.caregiverId = joelCaregiver._id;
        await joelCaregiverUser.save();
        console.log("  ~ Fixed montuyajoel2123@gmail.com -> EMP008");
    }

    const sarahCaregiver = await Caregiver.findOne({ employeeCode: "EMP003" });
    if (sarahCaregiver) {
        let sarahUser = await User.findOne({ email: "sarah.connor@homecare.ie" });
        if (!sarahUser) {
            sarahUser = await User.create({
                email: "sarah.connor@homecare.ie",
                role: "caregiver",
                isEmailVerified: true,
                caregiverId: sarahCaregiver._id,
            });
            sarahCaregiver.userId = sarahUser._id;
            await sarahCaregiver.save();
            console.log("  + User sarah.connor@homecare.ie -> EMP003");
        }
    }

    const sarahAdmin = await Admin.findOne({ employeeCode: "ADM-001" });
    if (sarahAdmin) {
        let adminUser = await User.findOne({ email: "sarah.oconnor_admin@homecare.ie" });
        if (!adminUser) {
            await User.create({
                email: "sarah.oconnor_admin@homecare.ie",
                role: "admin",
                isEmailVerified: true,
                adminId: sarahAdmin._id,
            });
            console.log("  + User sarah.oconnor_admin@homecare.ie -> ADM-001");
        }
    }
}

async function seed() {
    if (!process.env.MONGO_URI) {
        console.error("MONGO_URI is not set");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to:", mongoose.connection.name);

    await fixExistingLinks();

    const today = startOfDay();
    const tomorrow = startOfDay(addDays(today, 1));
    const adminUserId = new mongoose.Types.ObjectId(ADMIN_USER_ID);

    console.log("\nSeeding caregivers...");
    const maria = await ensureCaregiverWithUser({
        email: "maria.santos@homecare.ie",
        employeeCode: "EMP009",
        profile: {
            fullName: "Maria Santos",
            gender: "Female",
            age: 32,
            address: {
                addressLine: "12 O'Connell Street Upper",
                town: "Dublin 1",
                city: "Dublin",
                county: "Dublin",
                postCode: "D01 F5P2",
                latitude: 53.3523,
                longitude: -6.2632,
            },
            phoneNumber: "+353871112233",
            hasPetAllergy: false,
            skills: ["Personal Care", "Dementia Care", "Palliative Care"],
            availability: [
                { day: "Monday", startTime: "08:00", endTime: "18:00" },
                { day: "Tuesday", startTime: "08:00", endTime: "18:00" },
                { day: "Wednesday", startTime: "08:00", endTime: "18:00" },
                { day: "Thursday", startTime: "08:00", endTime: "18:00" },
                { day: "Friday", startTime: "08:00", endTime: "18:00" },
            ],
            status: "active",
        },
    });

    const liam = await ensureCaregiverWithUser({
        email: "liam.obrien@homecare.ie",
        employeeCode: "EMP010",
        profile: {
            fullName: "Liam O'Brien",
            gender: "Male",
            age: 41,
            address: {
                addressLine: "45 Rathmines Road Lower",
                town: "Rathmines",
                city: "Dublin",
                county: "Dublin",
                postCode: "D06 K5P9",
                latitude: 53.3209,
                longitude: -6.2668,
            },
            phoneNumber: "+353872223344",
            hasPetAllergy: true,
            skills: ["Mobility Support", "Meal Preparation", "Medication Support"],
            availability: [
                { day: "Monday", startTime: "09:00", endTime: "17:00" },
                { day: "Wednesday", startTime: "09:00", endTime: "17:00" },
                { day: "Friday", startTime: "09:00", endTime: "17:00" },
            ],
            status: "active",
        },
    });

    const aoife = await ensureCaregiverWithUser({
        email: "aoife.kelly@homecare.ie",
        employeeCode: "EMP011",
        profile: {
            fullName: "Aoife Kelly",
            gender: "Female",
            age: 29,
            address: {
                addressLine: "8 Sandymount Green",
                town: "Sandymount",
                city: "Dublin",
                county: "Dublin",
                postCode: "D04 V9X2",
                latitude: 53.3338,
                longitude: -6.2254,
            },
            phoneNumber: "+353873334455",
            hasPetAllergy: false,
            skills: ["Personal Care", "Wellbeing Check", "Meal Preparation"],
            availability: [
                { day: "Tuesday", startTime: "07:00", endTime: "15:00" },
                { day: "Thursday", startTime: "07:00", endTime: "15:00" },
                { day: "Saturday", startTime: "08:00", endTime: "14:00" },
            ],
            status: "active",
        },
    });

    const cian = await ensureCaregiverWithUser({
        email: "cian.murphy@homecare.ie",
        employeeCode: "EMP012",
        profile: {
            fullName: "Cian Murphy",
            gender: "Male",
            age: 36,
            address: {
                addressLine: "21 Drumcondra Road Lower",
                town: "Drumcondra",
                city: "Dublin",
                county: "Dublin",
                postCode: "D09 H6F3",
                latitude: 53.3612,
                longitude: -6.2541,
            },
            phoneNumber: "+353874445566",
            hasPetAllergy: false,
            skills: ["Mobility Support", "Personal Care", "Medication Support"],
            availability: [
                { day: "Monday", startTime: "07:00", endTime: "15:00" },
                { day: "Tuesday", startTime: "07:00", endTime: "15:00" },
                { day: "Wednesday", startTime: "07:00", endTime: "15:00" },
                { day: "Thursday", startTime: "07:00", endTime: "15:00" },
                { day: "Friday", startTime: "07:00", endTime: "15:00" },
            ],
            status: "active",
        },
    });

    const niamh = await ensureCaregiverWithUser({
        email: "niamh.byrne@homecare.ie",
        employeeCode: "EMP013",
        profile: {
            fullName: "Niamh Byrne",
            gender: "Female",
            age: 27,
            address: {
                addressLine: "14 Phibsborough Road",
                town: "Phibsborough",
                city: "Dublin",
                county: "Dublin",
                postCode: "D07 E5W4",
                latitude: 53.3567,
                longitude: -6.2734,
            },
            phoneNumber: "+353875556677",
            hasPetAllergy: true,
            skills: ["Dementia Care", "Personal Care", "Wellbeing Check"],
            availability: [
                { day: "Monday", startTime: "12:00", endTime: "20:00" },
                { day: "Wednesday", startTime: "12:00", endTime: "20:00" },
                { day: "Friday", startTime: "12:00", endTime: "20:00" },
            ],
            status: "active",
        },
    });

    const patrickCaregiver = await ensureCaregiverWithUser({
        email: "patrick.doyle@homecare.ie",
        employeeCode: "EMP014",
        profile: {
            fullName: "Patrick Doyle",
            gender: "Male",
            age: 44,
            address: {
                addressLine: "6 Blackrock Road",
                town: "Blackrock",
                city: "Dublin",
                county: "Dublin",
                postCode: "A94 T8X2",
                latitude: 53.3015,
                longitude: -6.1778,
            },
            phoneNumber: "+353876667788",
            hasPetAllergy: false,
            skills: ["Palliative Care", "Meal Preparation", "Mobility Support"],
            availability: [
                { day: "Tuesday", startTime: "08:00", endTime: "16:00" },
                { day: "Thursday", startTime: "08:00", endTime: "16:00" },
                { day: "Saturday", startTime: "09:00", endTime: "17:00" },
            ],
            status: "active",
        },
    });

    const siobhan = await ensureCaregiverWithUser({
        email: "siobhan.mccarthy@homecare.ie",
        employeeCode: "EMP015",
        profile: {
            fullName: "Siobhan McCarthy",
            gender: "Female",
            age: 38,
            address: {
                addressLine: "33 Cabra Road",
                town: "Cabra",
                city: "Dublin",
                county: "Dublin",
                postCode: "D07 K8N2",
                latitude: 53.3678,
                longitude: -6.2912,
            },
            phoneNumber: "+353877778899",
            hasPetAllergy: false,
            skills: ["Personal Care", "Medication Support", "Meal Preparation"],
            availability: [
                { day: "Monday", startTime: "09:00", endTime: "17:00" },
                { day: "Wednesday", startTime: "09:00", endTime: "17:00" },
                { day: "Friday", startTime: "09:00", endTime: "17:00" },
            ],
            status: "on-leave",
        },
    });

    const jamesCaregiver = await ensureCaregiverWithUser({
        email: "james.nolan@homecare.ie",
        employeeCode: "EMP016",
        profile: {
            fullName: "James Nolan",
            gender: "Male",
            age: 31,
            address: {
                addressLine: "9 Swords Main Street",
                town: "Swords",
                city: "Dublin",
                county: "Dublin",
                postCode: "K67 X4Y2",
                latitude: 53.4597,
                longitude: -6.2181,
            },
            phoneNumber: "+353878889900",
            hasPetAllergy: false,
            skills: ["Wellbeing Check", "Mobility Support", "Personal Care"],
            availability: [
                { day: "Monday", startTime: "06:00", endTime: "14:00" },
                { day: "Tuesday", startTime: "06:00", endTime: "14:00" },
                { day: "Thursday", startTime: "06:00", endTime: "14:00" },
                { day: "Friday", startTime: "06:00", endTime: "14:00" },
            ],
            status: "active",
        },
    });

    const sarahConnor = await Caregiver.findOne({ employeeCode: "EMP003" });
    const joelCaregiver = await Caregiver.findOne({ employeeCode: "EMP008" });

    console.log("\nSeeding clients...");
    const thomas = await ensureClient({
        clientCode: "CLT007",
        fullName: "Thomas Walsh",
        gender: "Male",
        age: 82,
        birthDate: "1944-05-12",
        preferredCaregiverGender: "No Preference",
        mobilityStatus: "Wheelchair-bound",
        cognitiveStatus: "Normal",
        address: {
            addressLine: "15 Merrion Square East",
            town: "Dublin 2",
            city: "Dublin",
            county: "Dublin",
            postCode: "D02 YX67",
            latitude: 53.3398,
            longitude: -6.2474,
        },
        phoneNumber: "+353851234567",
        hasPets: false,
        careNeeds: ["Personal Care", "Mobility Support"],
        emergencyContact: { name: "Sean Walsh", relationship: "Son", phoneNumber: "+353861234567" },
        notes: "Prefers morning visits. Uses wheelchair.",
        status: "active",
    });

    const nora = await ensureClient({
        clientCode: "CLT008",
        fullName: "Nora Murphy",
        gender: "Female",
        age: 75,
        birthDate: "1951-09-03",
        preferredCaregiverGender: "Female",
        mobilityStatus: "Assisted",
        cognitiveStatus: "Mild Cognitive Impairment",
        address: {
            addressLine: "22 Howth Road",
            town: "Clontarf",
            city: "Dublin",
            county: "Dublin",
            postCode: "D03 E5R6",
            latitude: 53.3645,
            longitude: -6.2098,
        },
        phoneNumber: "+353852345678",
        hasPets: true,
        careNeeds: ["Meal Preparation", "Medication Support", "Wellbeing Check"],
        emergencyContact: { name: "Kate Murphy", relationship: "Daughter", phoneNumber: "+353862345678" },
        notes: "Has a small dog. Needs medication reminders at lunch.",
        status: "active",
    });

    const james = await ensureClient({
        clientCode: "CLT009",
        fullName: "James Fitzpatrick",
        gender: "Male",
        age: 68,
        birthDate: "1958-02-20",
        preferredCaregiverGender: "No Preference",
        mobilityStatus: "Independent",
        cognitiveStatus: "Normal",
        address: {
            addressLine: "7 Templeogue Road",
            town: "Templeogue",
            city: "Dublin",
            county: "Dublin",
            postCode: "D06 K7W3",
            latitude: 53.2987,
            longitude: -6.3089,
        },
        phoneNumber: "+353853456789",
        hasPets: false,
        careNeeds: ["Wellbeing Check", "Meal Preparation"],
        emergencyContact: { name: "Paul Fitzpatrick", relationship: "Brother", phoneNumber: "+353863456789" },
        status: "active",
    });

    const fiona = await ensureClient({
        clientCode: "CLT010",
        fullName: "Fiona Ryan",
        gender: "Female",
        age: 91,
        birthDate: "1935-11-28",
        preferredCaregiverGender: "Female",
        mobilityStatus: "Bedridden",
        cognitiveStatus: "Dementia",
        address: {
            addressLine: "3 Stillorgan Road",
            town: "Donnybrook",
            city: "Dublin",
            county: "Dublin",
            postCode: "D04 A2B1",
            latitude: 53.3182,
            longitude: -6.2287,
        },
        phoneNumber: "+353854567890",
        hasPets: false,
        careNeeds: ["Personal Care", "Dementia Care", "Medication Support"],
        emergencyContact: { name: "Helen Ryan", relationship: "Daughter", phoneNumber: "+353864567890" },
        notes: "Requires two-person hoisting. Family visits on Sundays.",
        status: "active",
    });

    const mary = await Client.findOne({ clientCode: "CLT001" });
    const patrick = await Client.findOne({ clientCode: "CLT002" });

    console.log("\nSeeding schedules & visit logs...");

    // --- Today: mix of done / current / upcoming ---
    if (sarahConnor && mary) {
        const doneShift = await ensureSchedule({
            caregiver: sarahConnor._id,
            client: mary._id,
            date: today,
            startTime: "08:00:00",
            endTime: "10:00:00",
            status: "completed",
            createdBy: adminUserId,
        });
        await ensureVisitLog({
            schedule: doneShift._id,
            caregiver: sarahConnor._id,
            client: mary._id,
            clockIn: {
                time: shiftDateTime(today, "08:05:00"),
                location: { latitude: mary.address.latitude, longitude: mary.address.longitude },
            },
            clockOut: {
                time: shiftDateTime(today, "10:02:00"),
                location: { latitude: mary.address.latitude, longitude: mary.address.longitude },
            },
            durationMinutes: 117,
            status: "completed",
            isException: false,
            reviewRequired: false,
            reviewStatus: "not-required",
        });

        const currentShift = await ensureSchedule({
            caregiver: sarahConnor._id,
            client: nora._id,
            date: today,
            startTime: "11:00:00",
            endTime: "13:00:00",
            status: "in-progress",
            createdBy: adminUserId,
        });
        await ensureVisitLog({
            schedule: currentShift._id,
            caregiver: sarahConnor._id,
            client: nora._id,
            clockIn: {
                time: shiftDateTime(today, "11:03:00"),
                location: { latitude: nora.address.latitude, longitude: nora.address.longitude },
            },
            clockOut: { time: null, location: { latitude: null, longitude: null } },
            status: "in-progress",
            isException: false,
            reviewRequired: false,
            reviewStatus: "not-required",
        });

        await ensureSchedule({
            caregiver: sarahConnor._id,
            client: thomas._id,
            date: today,
            startTime: "15:00:00",
            endTime: "17:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }

    if (joelCaregiver && mary) {
        const joelDone = await ensureSchedule({
            caregiver: joelCaregiver._id,
            client: mary._id,
            date: today,
            startTime: "09:00:00",
            endTime: "11:00:00",
            status: "completed",
            createdBy: adminUserId,
        });
        await ensureVisitLog({
            schedule: joelDone._id,
            caregiver: joelCaregiver._id,
            client: mary._id,
            clockIn: {
                time: shiftDateTime(today, "09:10:00"),
                location: { latitude: mary.address.latitude, longitude: mary.address.longitude },
            },
            clockOut: {
                time: shiftDateTime(today, "11:05:00"),
                location: { latitude: mary.address.latitude, longitude: mary.address.longitude },
            },
            durationMinutes: 115,
            status: "completed",
            isException: true,
            exceptionType: ["late-clock-in"],
            note: "Traffic delay on N11",
            reviewRequired: true,
            reviewStatus: "pending-review",
        });

        await ensureSchedule({
            caregiver: joelCaregiver._id,
            client: james._id,
            date: today,
            startTime: "14:00:00",
            endTime: "16:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }

    if (maria && fiona) {
        await ensureSchedule({
            caregiver: maria._id,
            client: fiona._id,
            date: today,
            startTime: "10:00:00",
            endTime: "12:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
        await ensureSchedule({
            caregiver: maria._id,
            client: patrick?._id || thomas._id,
            date: today,
            startTime: "13:00:00",
            endTime: "15:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }

    if (liam && thomas) {
        await ensureSchedule({
            caregiver: liam._id,
            client: thomas._id,
            date: today,
            startTime: "12:00:00",
            endTime: "14:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }

    if (aoife && nora) {
        await ensureSchedule({
            caregiver: aoife._id,
            client: nora._id,
            date: today,
            startTime: "16:00:00",
            endTime: "18:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }

    if (cian && thomas) {
        await ensureSchedule({
            caregiver: cian._id,
            client: thomas._id,
            date: today,
            startTime: "07:30:00",
            endTime: "09:30:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }

    if (niamh && fiona) {
        await ensureSchedule({
            caregiver: niamh._id,
            client: fiona._id,
            date: today,
            startTime: "13:00:00",
            endTime: "15:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }

    if (patrickCaregiver && james) {
        await ensureSchedule({
            caregiver: patrickCaregiver._id,
            client: james._id,
            date: today,
            startTime: "17:00:00",
            endTime: "19:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }

    if (jamesCaregiver && mary) {
        await ensureSchedule({
            caregiver: jamesCaregiver._id,
            client: mary._id,
            date: today,
            startTime: "06:30:00",
            endTime: "08:30:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }

    // --- Tomorrow ---
    if (sarahConnor && james) {
        await ensureSchedule({
            caregiver: sarahConnor._id,
            client: james._id,
            date: tomorrow,
            startTime: "09:00:00",
            endTime: "11:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }
    if (maria && mary) {
        await ensureSchedule({
            caregiver: maria._id,
            client: mary._id,
            date: tomorrow,
            startTime: "08:00:00",
            endTime: "10:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }
    if (joelCaregiver && fiona) {
        await ensureSchedule({
            caregiver: joelCaregiver._id,
            client: fiona._id,
            date: tomorrow,
            startTime: "10:00:00",
            endTime: "12:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }
    if (cian && nora) {
        await ensureSchedule({
            caregiver: cian._id,
            client: nora._id,
            date: tomorrow,
            startTime: "12:00:00",
            endTime: "14:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }
    if (niamh && thomas) {
        await ensureSchedule({
            caregiver: niamh._id,
            client: thomas._id,
            date: tomorrow,
            startTime: "09:00:00",
            endTime: "11:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }
    if (patrickCaregiver && patrick) {
        await ensureSchedule({
            caregiver: patrickCaregiver._id,
            client: patrick._id,
            date: tomorrow,
            startTime: "14:00:00",
            endTime: "16:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }

    // --- Next week ---
    const nextWeek = startOfDay(addDays(today, 5));
    if (liam && patrick) {
        await ensureSchedule({
            caregiver: liam._id,
            client: patrick._id,
            date: nextWeek,
            startTime: "11:00:00",
            endTime: "13:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }
    if (aoife && fiona) {
        await ensureSchedule({
            caregiver: aoife._id,
            client: fiona._id,
            date: nextWeek,
            startTime: "14:00:00",
            endTime: "16:00:00",
            status: "scheduled",
            createdBy: adminUserId,
        });
    }

    console.log("\nSeeding leave requests...");
    await ensureLeaveRequest({
        employeeCode: "EMP003",
        fullName: "Sarah Connor",
        leaveType: "sick",
        startDate: addDays(today, 3),
        endDate: addDays(today, 4),
        reason: "Flu recovery",
        status: "pending",
    });

    await ensureLeaveRequest({
        employeeCode: "EMP009",
        fullName: "Maria Santos",
        leaveType: "vacation",
        startDate: addDays(today, 20),
        endDate: addDays(today, 27),
        reason: "Family holiday",
        status: "approved",
        approvedBy: adminUserId,
        adminNotes: "Coverage arranged with EMP011",
    });

    await ensureLeaveRequest({
        employeeCode: "EMP010",
        fullName: "Liam O'Brien",
        leaveType: "emergency",
        startDate: addDays(today, 1),
        endDate: addDays(today, 1),
        reason: "Family emergency abroad",
        status: "rejected",
        approvedBy: adminUserId,
        adminNotes: "No cover available on short notice",
    });

    await ensureLeaveRequest({
        employeeCode: "EMP008",
        fullName: "Joel Montuya",
        leaveType: "vacation",
        startDate: addDays(today, 30),
        endDate: addDays(today, 37),
        reason: "Annual leave",
        status: "pending",
    });

    await ensureLeaveRequest({
        employeeCode: "EMP015",
        fullName: "Siobhan McCarthy",
        leaveType: "sick",
        startDate: today,
        endDate: addDays(today, 2),
        reason: "Medical leave",
        status: "approved",
        approvedBy: adminUserId,
        adminNotes: "Coverage with EMP012 and EMP013",
    });

    // Summary
    const db = mongoose.connection.db;
    console.log("\n=== Final counts ===");
    for (const col of ["caregivers", "clients", "users", "schedules", "visitlogs", "leaverequests"]) {
        console.log(`  ${col}: ${await db.collection(col).countDocuments()}`);
    }

    await mongoose.disconnect();
    console.log("\nSeed complete.");
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
