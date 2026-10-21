const fs = require("fs/promises");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Load environment variables from the .env file
require("dotenv").config();

// --- 1. CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLE_NAME = process.env.TABLE; //change this later

const BATCH_SIZE = 100;

async function pushToSupabase(batchData) {
  try {
    const { error } = await supabase.from(TABLE_NAME).upsert(batchData);

    if (error) {
      throw error;
    }
    console.log(
      `Successfully pushed chunk of ${batchData.length} rows to Supabase.`,
    );
  } catch (error) {
    console.error(
      `Database insertion error occurred: ${error.message || error}`,
    );
  }
}

async function uploadFolder(FOLDER_PATH) {
  let batch = [];
  let totalInserted = 0;

  try {
    const files = await fs.readdir(FOLDER_PATH);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    console.log(`Total files detected: ${jsonFiles.length}`);

    for (const filename of jsonFiles) {
      try {
        const fileContent = await fs.readFile(
          path.join(FOLDER_PATH, filename),
          "utf-8",
        );
        const rawJson = JSON.parse(fileContent);

        const permitBlock = rawJson.permit_data || {};

        const pId = permitBlock.PermitId || permitBlock.record_id;

        // Safety check: Skip files missing the key identifier
        if (!pId) {
          console.log(
            `Skipping ${filename}: No PermitId found in the 'permit' block.`,
          );
          continue;
        }

        const schema = {
          ...rawJson.permit_data,
          data_hash: rawJson.permit_hash,
        };

        batch.push(schema);
      } catch (err) {
        console.error(`Error reading ${filename}: ${err.message}`);
        continue;
      }

      // Batch Push
      if (batch.length >= BATCH_SIZE) {
        await pushToSupabase(batch);
        totalInserted += batch.length;
        batch = [];
      }
    }

    // Push remaining records
    if (batch.length > 0) {
      await pushToSupabase(batch);
      totalInserted += batch.length;
    }

    console.log(`\nUpload complete. Total rows uploaded: ${totalInserted}`);
  } catch (err) {
    console.error(`Error accessing folder: ${err.message}`);
  }
}

module.exports = uploadFolder;
