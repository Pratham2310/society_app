const societyMapService = require("../services/societyMapService");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/responseHelper");

// =======================================================
// SOCIETY MAP
// =======================================================

exports.listMap = asyncHandler(async (req, res) => {
  const data = await societyMapService.listMap(req);
  sendResponse(res, 200, true, "Map fetched successfully", data);
});

exports.getCatalog = asyncHandler(async (req, res) => {
  const data = await societyMapService.getCatalog(req);
  sendResponse(res, 200, true, "Catalogue fetched successfully", data);
});

exports.addMapItem = asyncHandler(async (req, res) => {
  const data = await societyMapService.addMapItem(req);
  sendResponse(res, 201, true, "Added to the map", data);
});

exports.updateMapItem = asyncHandler(async (req, res) => {
  const data = await societyMapService.updateMapItem(req);
  sendResponse(res, 200, true, "Map item updated", data);
});

exports.deleteMapItem = asyncHandler(async (req, res) => {
  const data = await societyMapService.deleteMapItem(req);
  sendResponse(res, 200, true, "Removed from the map", data);
});
