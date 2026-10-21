/**
 * comparePermitHashes.js
 *
 * Compares permit data hashes from a folder of permit JSON files against
 * a known "index" JSON array (permit_id / permit_number / data_hash).
 *
 * - If a permit's hash matches the index -> nothing changed, just logged.
 * - If a permit's hash does NOT match (or the permit isn't in the index at
 *   all, i.e. it's new) -> the full permit JSON is copied into the output
 *   folder so you know which ones need attention.
 *
 * A summary log file is also written into the output folder.
 *
 * Usage:
 *   node comparePermitHashes.js <indexFilePath> <inputFolderPath> <outputFolderPath>
 *
 * Or import the function directly:
 *   const { comparePermitHashes } = require('./comparePermitHashes');
 *   comparePermitHashes(indexPath, inputFolder, outputFolder);
 */

const fs = require("fs");
const path = require("path");

/**
 * Pulls the permit id and hash out of a permit file's parsed JSON.
 * Adjust here if your permit file shape ever changes.
 */
function extractPermitInfo(parsed, filename) {
  const permit = parsed?.permit_data;
  const permitId = permit?.record_id;
  const permitNumber = permit?.record_number;
  const hash = parsed?.permit_hash;

  if (!permitId || !hash) {
    throw new Error(
      `File "${filename}" is missing permit_data.permit.PermitId or permit_hash`,
    );
  }

  return { permitId, permitNumber, hash };
}

function loadIndex(indexFilePath) {
  const raw = fs.readFileSync(indexFilePath, "utf8");
  const arr = JSON.parse(raw);

  if (!Array.isArray(arr)) {
    throw new Error(`Index file "${indexFilePath}" must contain a JSON array`);
  }

  const map = new Map();
  for (const entry of arr) {
    if (!entry.record_id) continue;
    map.set(entry.record_id, {
      permit_number: entry.record_number,
      data_hash: entry.data_hash,
    });
  }
  return map;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function comparePermitHashes(indexFilePath, inputFolderPath, outputFolderPath) {
  const indexMap = loadIndex(indexFilePath);

  const files = fs
    .readdirSync(inputFolderPath)
    .filter((f) => f.toLowerCase().endsWith(".json"));

  ensureDir(outputFolderPath);

  const results = {
    identical: [],
    changed: [],
    newPermits: [],
    errors: [],
  };

  for (const filename of files) {
    const filePath = path.join(inputFolderPath, filename);

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
      results.errors.push({ filename, reason: `Invalid JSON: ${err.message}` });
      continue;
    }

    let info;
    try {
      info = extractPermitInfo(parsed, filename);
    } catch (err) {
      results.errors.push({ filename, reason: err.message });
      continue;
    }

    const indexEntry = indexMap.get(info.permitId);

    if (!indexEntry) {
      // Not in the index at all -> treat as new, save it.
      results.newPermits.push({
        filename,
        permitId: info.permitId,
        permitNumber: info.permitNumber,
      });
      copyPermitToOutput(filePath, filename, outputFolderPath);
      continue;
    }

    if (indexEntry.data_hash === info.hash) {
      // Match -> nothing to do.
      results.identical.push({
        filename,
        permitId: info.permitId,
        permitNumber: info.permitNumber,
      });
    } else {
      // Mismatch -> hash changed, save full permit to output.
      results.changed.push({
        filename,
        permitId: info.permitId,
        permitNumber: info.permitNumber,
        oldHash: indexEntry.data_hash,
        newHash: info.hash,
      });
      copyPermitToOutput(filePath, filename, outputFolderPath);
    }
  }

  writeLog(outputFolderPath, results);
  printSummary(results);

  return results;
}

function copyPermitToOutput(sourceFilePath, filename, outputFolderPath) {
  const destPath = path.join(outputFolderPath, filename);
  fs.copyFileSync(sourceFilePath, destPath);
}

function writeLog(outputFolderPath, results) {
  const timestamp = new Date().toISOString();
  const lines = [];

  lines.push(`Permit hash comparison run: ${timestamp}`);
  lines.push("");

  lines.push(`IDENTICAL (${results.identical.length}) - no action taken:`);
  for (const r of results.identical) {
    lines.push(`  - ${r.permitNumber || r.permitId} (${r.filename})`);
  }
  lines.push("");

  lines.push(`CHANGED (${results.changed.length}) - saved to output folder:`);
  for (const r of results.changed) {
    lines.push(
      `  - ${r.permitNumber || r.permitId} (${r.filename}) : ${r.oldHash} -> ${r.newHash}`,
    );
  }
  lines.push("");

  lines.push(
    `NEW (${results.newPermits.length}) - not in index, saved to output folder:`,
  );
  for (const r of results.newPermits) {
    lines.push(`  - ${r.permitNumber || r.permitId} (${r.filename})`);
  }
  lines.push("");

  lines.push(`ERRORS (${results.errors.length}):`);
  for (const r of results.errors) {
    lines.push(`  - ${r.filename}: ${r.reason}`);
  }
  lines.push("");

  const logPath = path.join(
    outputFolderPath,
    `comparison-log-${Date.now()}.txt`,
  );
  fs.writeFileSync(logPath, lines.join("\n"), "utf8");
}

function printSummary(results) {
  console.log("--- Permit Hash Comparison Summary ---");
  console.log(`Identical: ${results.identical.length}`);
  console.log(`Changed:   ${results.changed.length}`);
  console.log(`New:       ${results.newPermits.length}`);
  console.log(`Errors:    ${results.errors.length}`);
}

module.exports = { comparePermitHashes };
