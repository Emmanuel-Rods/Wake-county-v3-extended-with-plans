const fs = require("fs");
const path = require("path");
const isEqual = require("lodash/isEqual");

// const OLD_DATA_FILE = "issued_permits.json"; // Path to your older JSON array file
// const NEW_FOLDER = "NEWcleaned"; // Path to your newer JSON files
// const DIFF_FOLDER = "./diff_data"; // Path where differing/new files will be copied
const LOG_FILE = "comparison_log.txt"; // Path for the generated log file

function areJsonContentsEqual(json1, json2) {
  return isEqual(json1, json2);
}

async function compareData(OLD_DATA_FILE, NEW_FOLDER, DIFF_FOLDER) {
  // Object to store our logs by category
  const logs = {
    new: [],
    changed: [],
    identical: [],
    warnings: [],
  };

  // Helper function to both console.log and save to our log object
  function recordLog(category, message) {
    console.log(message); // Keep console output for real-time feedback
    if (logs[category]) {
      logs[category].push(message);
    }
  }

  try {
    await fs.promises.mkdir(DIFF_FOLDER, { recursive: true });
    recordLog("warnings", `Ensured '${DIFF_FOLDER}' directory exists.`);
  } catch (err) {
    console.error(`Error creating diff directory: ${err}`);
    return;
  }

  // 1. Read and map the old data
  const oldDataMap = new Map();
  try {
    const oldFileContent = await fs.promises.readFile(OLD_DATA_FILE, "utf8");
    const oldDataArray = JSON.parse(oldFileContent);

    if (!Array.isArray(oldDataArray)) {
      console.error(`Error: Data in '${OLD_DATA_FILE}' is not an array.`);
      return;
    }

    // Map using the top-level permit_id from the old data array
    for (const record of oldDataArray) {
      const key = record.permit_id || record.permit_number || record.record_id;
      if (key) {
        oldDataMap.set(key, record);
      }
    }
    recordLog(
      "warnings",
      `Loaded ${oldDataMap.size} historical records from '${OLD_DATA_FILE}'.`,
    );
  } catch (err) {
    console.error(`Error reading older data file: ${err.message}`);
    return;
  }

  // 2. Read new folder
  let newFiles = [];
  try {
    newFiles = await fs.promises.readdir(NEW_FOLDER);
    recordLog("warnings", `Found ${newFiles.length} files in '${NEW_FOLDER}'.`);
  } catch (err) {
    console.error(`Error reading new data directory: ${err}`);
    return;
  }

  // 3. Process new files
  for (const file of newFiles) {
    if (path.extname(file) !== ".json") {
      continue;
    }

    const newFilePath = path.join(NEW_FOLDER, file);
    const diffFilePath = path.join(DIFF_FOLDER, file);

    try {
      const newFileContent = await fs.promises.readFile(newFilePath, "utf8");
      const newJson = JSON.parse(newFileContent);

      // EXTRACT ID FROM NEW DATA: Look inside the "permit" object
      const recordKey =
        newJson.permit?.PermitId ||
        newJson.permit?.PermitNumber ||
        newJson.permit?.record_number;

      if (!recordKey) {
        recordLog(
          "warnings",
          `[WARNING] '${file}' does not contain 'permit.PermitId'. Skipping.`,
        );
        continue;
      }

      if (!oldDataMap.has(recordKey)) {
        // CASE 1: Brand new permit
        await fs.promises.copyFile(newFilePath, diffFilePath);
        recordLog(
          "new",
          `[NEW] '${file}' (ID: ${recordKey}) copied to '${DIFF_FOLDER}'.`,
        );
      } else {
        // CASE 2: Permit exists in both.
        const oldRecord = oldDataMap.get(recordKey);

        // ONLY COMPARE: The entire new file VS the old record's "permit_data" property
        if (!areJsonContentsEqual(newJson, oldRecord.permit_data)) {
          // Content differs!
          await fs.promises.copyFile(newFilePath, diffFilePath);
          recordLog(
            "changed",
            `[CHANGED] '${file}' differs from old permit_data. Copied to '${DIFF_FOLDER}'.`,
          );
        } else {
          // Exactly the same
          recordLog(
            "identical",
            `[IDENTICAL] '${file}' is identical to the old permit_data. Skipping.`,
          );
        }
      }
    } catch (err) {
      recordLog(
        "warnings",
        `[ERROR] Error processing file '${file}': ${err.message}`,
      );
    }
  }

  // 4. Generate and save the Log File
  console.log("\nGenerating log file...");

  let logOutput = `=== COMPARISON LOG ===\n`;
  logOutput += `Date: ${new Date().toLocaleString()}\n\n`;

  logOutput += `--- NEW FILES (${logs.new.length}) ---\n`;
  logOutput +=
    logs.new.length > 0 ? logs.new.join("\n") : "No new files found.";
  logOutput += `\n\n`;

  logOutput += `--- CHANGED FILES (${logs.changed.length}) ---\n`;
  logOutput +=
    logs.changed.length > 0
      ? logs.changed.join("\n")
      : "No changed files found.";
  logOutput += `\n\n`;

  logOutput += `--- IDENTICAL FILES (${logs.identical.length}) ---\n`;
  logOutput +=
    logs.identical.length > 0
      ? logs.identical.join("\n")
      : "No identical files found.";
  logOutput += `\n\n`;

  logOutput += `--- WARNINGS & ERRORS (${logs.warnings.length}) ---\n`;
  logOutput +=
    logs.warnings.length > 0
      ? logs.warnings.join("\n")
      : "No warnings or errors.";
  logOutput += `\n`;

  try {
    await fs.promises.writeFile(LOG_FILE, logOutput, "utf8");
    console.log(`Success! Comparison complete. Log saved to '${LOG_FILE}'.`);
  } catch (err) {
    console.error(`Failed to write log file: ${err.message}`);
  }
}

module.exports = compareData;
