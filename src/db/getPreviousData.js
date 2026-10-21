const { createClient } = require("@supabase/supabase-js");
const fs = require("fs").promises;

require("dotenv").config();

// Replace these with your actual Supabase project URL and API key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const table = process.env.TABLE;

async function getDataByStatus(status) {
  let allPermits = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  try {
    console.log("Fetching data from Supabase...");

    while (hasMore) {
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from(table)
        .select("record_id, record_number, data_hash")
        .eq("status", status) //status here
        .range(from, to);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allPermits.push(...data);

        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(
      `Retrieved ${allPermits.length} records. Writing to JSON file...`,
    );

    // Convert array to JSON string with 2-space indentation for readability
    const jsonData = JSON.stringify(allPermits, null, 2);

    // Write to a local file
    await fs.writeFile(`${status}.json`, jsonData, "utf-8");
    console.log(`Data successfully written to ${status}.json`);
    return `${status}.json`; //returns filename
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
}

module.exports = getDataByStatus;
