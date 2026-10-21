const base = "https://wakecountync-energovpub.tylerhost.net/apps"; // No trailing slash

const dateOffset = 200; // 1 = yesterday

// statuses that need to pulled using daily.js
const requiredStatuses = ["Complete"];

// permit types
const requiredSecondaryData = ["Land Use Permit - Simple"];

//status that need be updated
const updateStatuses = ["Complete"];

// exports
module.exports = {
  base,
  dateOffset,
  requiredStatuses,
  requiredSecondaryData,
  updateStatuses,
};
