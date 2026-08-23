/**
 * One-time migration: copy visit logs and their dependencies from local MongoDB to Atlas.
 * Remaps caregiver IDs when the same person exists under different _id in Atlas.
 * Usage: node scripts/migrateLocalToAtlas.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const LOCAL_URI = process.env.LOCAL_MONGO_URI || "mongodb://localhost:27017/homecare";
const ATLAS_URI = process.env.MONGO_URI;

if (!ATLAS_URI) {
    console.error("MONGO_URI is not set in .env");
    process.exit(1);
}

async function connect(uri) {
    return mongoose.createConnection(uri).asPromise();
}

async function upsertDocs(atlasDb, collectionName, docs) {
    if (docs.length === 0) return { collection: collectionName, upserted: 0, modified: 0, matched: 0 };

    const ops = docs.map((doc) => ({
        replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true,
        },
    }));

    const result = await atlasDb.collection(collectionName).bulkWrite(ops, { ordered: false });
    return {
        collection: collectionName,
        upserted: result.upsertedCount,
        modified: result.modifiedCount,
        matched: result.matchedCount,
    };
}

function buildCaregiverIdMap(localCaregivers, atlasCaregivers) {
    const map = new Map();

    for (const local of localCaregivers) {
        const atlasMatch = atlasCaregivers.find(
            (atlas) =>
                atlas.employeeCode === local.employeeCode ||
                atlas.userId?.toString() === local.userId?.toString()
        );

        if (atlasMatch) {
            map.set(local._id.toString(), atlasMatch._id);
        }
    }

    return map;
}

function remapCaregiverId(value, caregiverIdMap) {
    const key = value?.toString();
    return caregiverIdMap.has(key) ? caregiverIdMap.get(key) : value;
}

function cloneWithCaregiverRemap(doc, caregiverIdMap) {
    const copy = { ...doc, caregiver: remapCaregiverId(doc.caregiver, caregiverIdMap) };
    return copy;
}

async function migrate() {
    console.log("Local:", LOCAL_URI);
    console.log("Atlas: (from MONGO_URI)");

    const local = await connect(LOCAL_URI);
    const atlas = await connect(ATLAS_URI);

    try {
        const localDb = local.db;
        const atlasDb = atlas.db;

        const visitLogs = await localDb.collection("visitlogs").find({}).toArray();
        if (visitLogs.length === 0) {
            console.log("No visit logs found in local database. Nothing to migrate.");
            return;
        }

        const scheduleIds = [...new Set(visitLogs.map((v) => v.schedule.toString()))];
        const schedules = await localDb
            .collection("schedules")
            .find({ _id: { $in: scheduleIds.map((id) => new mongoose.Types.ObjectId(id)) } })
            .toArray();

        const localCaregivers = await localDb.collection("caregivers").find({}).toArray();
        const atlasCaregivers = await atlasDb.collection("caregivers").find({}).toArray();
        const caregiverIdMap = buildCaregiverIdMap(localCaregivers, atlasCaregivers);

        console.log("\nCaregiver ID remap:");
        for (const [from, to] of caregiverIdMap) {
            if (from !== to.toString()) {
                console.log(`  ${from} -> ${to}`);
            }
        }

        const remappedSchedules = schedules.map((s) => cloneWithCaregiverRemap(s, caregiverIdMap));
        const remappedVisitLogs = visitLogs.map((v) => cloneWithCaregiverRemap(v, caregiverIdMap));

        console.log("\nMigrating:");
        console.log("  schedules:", remappedSchedules.length);
        console.log("  visitlogs:", remappedVisitLogs.length);

        const results = [];
        results.push(await upsertDocs(atlasDb, "schedules", remappedSchedules));
        results.push(await upsertDocs(atlasDb, "visitlogs", remappedVisitLogs));

        console.log("\nResults:");
        for (const r of results) {
            console.log(`  ${r.collection}: upserted=${r.upserted}, modified=${r.modified}, matched=${r.matched}`);
        }

        const atlasVisitCount = await atlasDb.collection("visitlogs").countDocuments();
        console.log("\nAtlas visitlogs count after migration:", atlasVisitCount);

        const targetId = new mongoose.Types.ObjectId("6a89625bfa115a349f5a558c");
        const verified = await atlasDb.collection("visitlogs").findOne({ _id: targetId });
        console.log(
            "Verified visit log 6a89625b...:",
            verified ? `FOUND (${verified.status}, caregiver=${verified.caregiver})` : "NOT FOUND"
        );
    } finally {
        await local.close();
        await atlas.close();
    }
}

migrate().catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
});
