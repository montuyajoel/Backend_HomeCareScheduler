const mongoose = require("mongoose");
const { sanitizeMongoUri } = require("./sanitizeMongoUri");

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not defined");
    }

    if (!cached.promise) {
        cached.promise = mongoose.connect(process.env.MONGO_URI).then((mongooseInstance) => {
            console.log("? Connected to MongoDB:", sanitizeMongoUri(process.env.MONGO_URI));
            return mongooseInstance;
        });
    }

    cached.conn = await cached.promise;
    return cached.conn;
}

module.exports = connectDB;
