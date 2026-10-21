const fs = require("fs");

const getAllResults = require("./src/search-permits/search.js");
const fetchNewPermits = require("./src/utils/fetchPermits.js");
const uploadFolder = require("./src/db/upload.js");

const cleanupFolders = require("./src/utils/deleteFolders.js");
const loadJson = require("./src/utils/load.js");

const {
  validateStatuses,
  validatePermitTypes,
} = require("./src/utils/validate.config.js");

// configs
const {
  base,
  dateOffset,
  requiredStatuses,
  requiredSecondaryData,
} = require("./config.js");

// making sure the files exits
const statusIds = loadJson("./site.data/plans.status.ids.json"); //change this
const secondaryIds = loadJson("./site.data/secondary.data.json");

//validate the the contents of the array matches with the files
validatePermitTypes(secondaryIds, requiredSecondaryData);
validateStatuses(statusIds, requiredStatuses);

function getStatusByName(jsonData, targetName) {
  return jsonData.Result?.find((item) => item.Name === targetName) || null;
}

function getSecondaryDataByName(jsonData, targetName) {
  return (
    jsonData.Result?.CaseTypes?.find(
      (item) => item.CaseTypeName === targetName,
    ) || null
  );
}

function getDateDaysAgo(offset = 1) {
  const date = new Date();
  date.setDate(date.getDate() - offset); // deafault is 1 , yesterday
  date.setUTCHours(0, 0, 0, 0); // Set time to midnight UTC
  console.log("Issued date :", date.toISOString().split("T")[0]);
  return date.toISOString();
}

const payload = loadJson("src/search-permits/payload.json");

async function getResultsforStatues(second) {
  payload.PlanCriteria.PlanTypeId = second; // change this
  console.log("Secondary data", second);
  //need to delete daily permits or it will just append to the older file
  fs.rmSync("./daily_permits.json", { force: true });

  for (const status of requiredStatuses) {
    const statusObj = getStatusByName(statusIds, status);

    payload.PlanCriteria.PlanStatusId = statusObj.PlanStatusId;

    console.log("Getting for status :", statusObj.Name);

    payload.PlanCriteria.ApplyDateFrom = getDateDaysAgo(dateOffset); // 2 days ago
    // console.log(getDateDaysAgo(15));
    await getAllResults(payload, statusObj.Name, "daily_permits.json", base); // creates file
  }

  // if no results are there then no daily_permits.json file will be formed , so need to handle that edgecase
  if (!fs.existsSync("daily_permits.json")) {
    return;
  }

  // get info
  await fetchNewPermits("daily_permits.json", "daily_permits", base);
  //push to db
  await uploadFolder("daily_permits");

  // uncomment later
  await cleanupFolders(["daily_permits"]);
}

async function main() {
  for (const second of requiredSecondaryData) {
    const data = getSecondaryDataByName(secondaryIds, second);
    console.log(data.CaseTypeId);
    await getResultsforStatues(data.CaseTypeId);
  }
  console.log("All done");
}

main();
