const mongoose = require("mongoose");
const { sanitizeMongoUri } = require("./sanitizeMongoUri");

mongoose.set("bufferCommands", false);

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not defined");
    }

    if (!cached.promise) {
        cached.promise = mongoose
            .connect(process.env.MONGO_URI, {
                serverSelectionTimeoutMS: 8000,
                maxPoolSize: 10,
            })
            .then((mongooseInstance) => {
                console.log("Connected to MongoDB:", sanitizeMongoUri(process.env.MONGO_URI));
                return mongooseInstance;
            })
            .catch((error) => {
                cached.promise = null;
                cached.conn = null;
                throw error;
            });
    }

    cached.conn = await cached.promise;
    return cached.conn;
}

module.exports = connectDB;
