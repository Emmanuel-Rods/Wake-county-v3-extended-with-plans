const fs = require("fs").promises;
const path = require("path");

/**
 * Extracts a numeric value from the description text if the main Value field is 0 or null.
 */
function extractValueFromDescription(value, description) {
  if (value && value > 0) return value;
  if (!description) return null;

  const match = description.match(/\$([\d,]+(?:\.\d{2})?)/);
  if (match && match[1]) {
    return parseFloat(match[1].replace(/,/g, ""));
  }
  return null;
}

/**
 * Flattens and cleans raw Tyler API JSON into the Supabase schema.
 */
function cleanJsonObject(rawJson) {
  // 1. Determine module type dynamically
  const isPlan = !!rawJson.plan;
  const moduleType = isPlan ? "Plan" : "Permit";

  // 2. Extract core payload
  const coreData = isPlan
    ? rawJson.plan?.Result || rawJson.plan || {}
    : rawJson.permit?.Result || rawJson.permit || {};

  const addressInfo = coreData.MainAddressInfo || {};

  // 3. Extract JSON Arrays
  const contacts = rawJson.contacts?.Result || [];
  const summary = rawJson.summary?.Result || [];
  const inspections = rawJson.inspections?.Result || null;
  const locations = rawJson.location?.Result || null;

  // 4. Build the all_parcel_numbers array
  const parcelSet = new Set();
  if (coreData.MainParcelNumber) {
    parcelSet.add(coreData.MainParcelNumber);
  }
  if (locations && Array.isArray(locations)) {
    locations.forEach((loc) => {
      if (loc.Parcel && loc.Parcel.ParcelNumber) {
        parcelSet.add(loc.Parcel.ParcelNumber);
      }
    });
  }
  const allParcelNumbers = Array.from(parcelSet);

  // 5. Build additional_details catch-all (specifically for plans)
  let additionalDetails = null;
  if (isPlan) {
    additionalDetails = {
      approval_expire_date: coreData.ApprovalExpireDate || null,
      hold_exist: coreData.HoldExist || false,
      hold_exist_on_inspection: coreData.HoldExistOnInspection || false,
      unpaid_fees: coreData.UnPaidFees || false,
      unpaid_invoiced_fees: coreData.UnPaidInvoicedFees || false,
      failed_reviews: coreData.FailedReviews || false,
      failed_inspections: coreData.FailedInspections || false,
      e_review_enable: coreData.EReviewEnable || false,
      is_e_review_case_type: coreData.IsEReviewCaseType || false,
      project_id: coreData.ProjectId || null,
      entity_holds: coreData.EntityHolds || null,
    };
  }

  // 6. Construct the final flattened record
  const formattedRecord = {
    record_id: coreData.PlanId || coreData.PermitId || null,
    record_number: coreData.PlanNumber || coreData.PermitNumber || null,
    record_type: coreData.PlanType || coreData.PermitType || null,
    status: coreData.PlanStatus || coreData.PermitStatus || null,
    main_address: coreData.MainAddress || null,
    job_value: extractValueFromDescription(
      coreData.Value,
      coreData.Description,
    ),
    apply_date: coreData.ApplyDate || null,
    ivr_number: coreData.IVRNumber || null,
    issue_date: coreData.IssueDate || rawJson.metadata?.IssueDate || null,
    assigned_to: coreData.AssignedTo || null,
    expire_date: coreData.ExpireDate || null,
    square_feet: coreData.SquareFeet || null,
    description: coreData.Description || null,
    project_name: coreData.ProjectName || null,
    district_name: coreData.DistrictName || null,
    finalize_date: coreData.FinalizeDate || coreData.CompleteDate || null,
    assigned_to_email: coreData.AssignedToEmail || null,
    work_class_name: coreData.WorkClassName || coreData.PlanWorkClassId || null,
    main_parcel_number: coreData.MainParcelNumber || null,

    // Address Breakdown
    city: addressInfo.City || null,
    state: addressInfo.State || null,
    county: addressInfo.County || null,
    country: addressInfo.Country || null,
    postal_code: addressInfo.PostalCode || null,
    street_type: addressInfo.StreetType || null,
    address_line_1: addressInfo.AddressLine1 || null,
    address_line_2: addressInfo.AddressLine2 || null,
    address_line_3: addressInfo.AddressLine3 || null,

    // Nested JSON Payloads
    contacts: contacts,
    inspections: inspections,
    summary: summary,
    locations: locations,
    all_parcel_numbers: allParcelNumbers,
    additional_details: additionalDetails,

    // System/Meta Fields
    module_type: moduleType,
    attachment: null, ///  attachmentUrl hard null for now
  };

  return formattedRecord;
}

module.exports = { cleanJsonObject };
