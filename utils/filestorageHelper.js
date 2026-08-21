/*Util/filestorageHelper -- contains functions for upload, download and delete file in the repo
Filename is replaced by hash -- avoid name duplication
Saved in the repo as clientCode/filename.pdf
*/
//CarePlan File upload approach: Blob storage: Supabase - Free 50MB
//Middleware: uses Multer as Memory storage to facilitate uploading pdf files to Supabase
//File Limit:10MB per upload
//Current allowed file extension: PDF - can be changed

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME;

const supabase = createClient(supabaseUrl, supabaseKey);

const crypto = require("crypto");
const path = require("path");

function generateHashedFilename(originalFilename) {
    const extension = path.extname(originalFilename).toLowerCase();

    const randomInput = [
        originalFilename,
        Date.now().toString(),
        crypto.randomUUID(),
    ].join("-");

    const hash = crypto
        .createHash("sha256")
        .update(randomInput)
        .digest("hex");

    return `${hash}${extension}`;
}

// Uploads a Multer memory-storage file to Supabase.
const uploadFile = async (file, clientId) => {
    if (!file) {
        throw new Error("No file was provided");
    }

    if (!clientId) {
        throw new Error("Client ID is required");
    }

    const storedFilename = generateHashedFilename(
        file.originalname
    );


    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(`${clientId}/${storedFilename}`,
            file.buffer,
            {
                contentType: file.mimetype,
                cacheControl: "3600",
                upsert: false,
            }
        );

    if (error) {
        throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return {
        bucket: bucketName,
        objectPath: data.path,
        storedFilename,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
    };
}

//Downloads a private file from Supabase.
async function downloadFile(objectPath) {
    if (!objectPath) {
        throw new Error("Object path is required");
    }

    const { data, error } = await supabase.storage
        .from(bucketName)
        .download(objectPath);

    if (error) {
        throw new Error(`Supabase download failed: ${error.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();

        return Buffer.from(arrayBuffer);
}

//Removes a file from Supabase.
async function deleteFile(objectPath) {
    const { data, error } = await supabase.storage
        .from(bucketName)
        .remove([objectPath]);

    if (error) {
        throw new Error(`Supabase deletion failed: ${error.message}`);
    }

    return data;
}

// Checks if the Supabase connection is working by attempting to fetch a small amount of data from the 'careplans' table.
async function checkSupabaseConnection() {
    try {
        const { data, error } = await supabase.storage
        .from(bucketName)
        .list("", {limit: 1,});
        
        if (error) {
            console.error("Supabase storage connection failed:", error.message);
            return false;
        }

        console.log("✅ Supabase storage connection successful");
        return true;
    } catch (error) {
        console.error("Supabase connection error:", error.message);
        return false;
    }
}

module.exports = {
    uploadFile,
    downloadFile,
    deleteFile,
    generateHashedFilename,
    checkSupabaseConnection
};