const fs = require("fs");
const path = require("path");

const get_contacts = require("../apis/contacts.js");
const get_fees = require("../apis/fees.js");
const get_holds = require("../apis/holds.js");
const get_inspection = require("../apis/inspection.js");
const get_permit = require("../apis/permit.js");
const get_summary = require("../apis/summary.js");
const get_location = require("../apis/location.js");
const get_plans = require("../apis/plan.js");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// utils
const { cleanJsonObject } = require("./cleaner.js");
const { hash } = require("./create.hash.js");

async function fetchNewPermits(file, outputFolder = "permits", base) {
  try {
    // Ensure the "permits" folder exists
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    // Read and parse input file
    const fileContent = fs.readFileSync(file, "utf8");
    const permits = JSON.parse(fileContent);

    console.log(`Loaded ${permits.length} cases. Starting data extraction...`);

    for (const permitCase of permits) {
      const CaseId =
        permitCase.permit_id || permitCase.CaseId || permitCase.record_id;
      // Try to get permit_number, if not there, fallback to CaseNumber
      const CaseNumber =
        permitCase.permit_number ||
        permitCase.CaseNumber ||
        permitCase.record_number;

      if (!CaseId || !CaseNumber) {
        console.warn("Skipping record due to missing CaseId or CaseNumber.");
        continue;
      }

      console.log(`Processing Case: ${CaseNumber} (${CaseId})...`);

      try {
        const [contacts, plan, summary, location] = await Promise.all([
          get_contacts(CaseId, base).catch((err) => ({
            error: true,
            message: err.message,
          })),
          get_plans(CaseId, base).catch((err) => ({
            error: true,
            message: err.message,
          })),
          get_summary(CaseId, base).catch((err) => ({
            error: true,
            message: err.message,
          })),
          get_location(CaseId, base).catch((err) => ({
            error: true,
            message: err.message,
          })),
        ]);

        // Structure the consolidated object
        const consolidatedData = {
          metadata: permitCase, // Optional: keeps original file values alongside details
          contacts,
          plan,
          summary,
          location,
        };

        // Sanitize CaseNumber to ensure valid filesystem filename
        const safeFileName = `${CaseNumber.replace(/[/\\?%*:|"<>]/g, "-")}.json`;
        const destinationPath = path.join(outputFolder, safeFileName);

        //cleaning the file before writing to skip a step
        const cleanedData = cleanJsonObject(consolidatedData, safeFileName);
        const permit_hash = hash(cleanedData);
        const data_with_permit_hash = {
          permit_data: cleanedData,
          permit_hash: permit_hash,
        };
        // Write the gathered data to its file
        fs.writeFileSync(
          destinationPath,
          JSON.stringify(data_with_permit_hash, null, 2),
        );

        console.log(`Saved -> ${safeFileName}`);
        await delay(500); // doubled the delay timings
      } catch (caseError) {
        console.error(`Error processing Case ${CaseNumber}:`, caseError);
      }
    }

    console.log("All tasks completed.");
  } catch (err) {
    console.error("Failed to run extraction process:", err);
  }
}

module.exports = fetchNewPermits;
