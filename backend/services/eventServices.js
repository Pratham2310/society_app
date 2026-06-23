const eventRepo = require("../repository/eventRepository");
const Event = require("../models/Events"); 
const AppError = require("../utils/appError");

//  CREATE EVENT
exports.createEvent = async (req) => {

  const { title, eventDate, time, location } = req.body;

  if (!title || !eventDate) {
    throw new AppError("Title and EventDate are required", 400);
  }

  //  DUPLICATE CHECK
  const existingEvent = await Event.findOne({
    societyId: req.user.societyId,
    eventDate,
    time,
    location
  });

  if (existingEvent) {
    throw new AppError(
      "Another event already scheduled at same time & location",
      400
    );
  }

  const event = await eventRepo.createEvent({
    ...req.body,
    societyId: req.user.societyId,
    createdBy: req.user.id,
    hostName: req.user.name
  });

  return event.toObject();
};



//  GET ALL EVENTS
exports.getEvent = async (req) => {

  const { limit = 10 } = req.query;

  const filter = {
    societyId: req.user.societyId,
    eventDate: { $gte: new Date() }
  };

  return await eventRepo.findAll(filter, Number(limit));
};



//  GET SINGLE
exports.getEventById = async (id, req) => {

  const event = await eventRepo.findById(id); //  FIXED

  if (!event || event.societyId.toString() !== req.user.societyId) {
    throw new AppError("Event not found", 404);
  }

  return event;
};



//  UPDATE (ONLY CREATOR)
exports.updateEvent = async (id, data, req) => {

  const event = await eventRepo.findById(id);

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  if (event.createdBy.toString() !== req.user.id) {
    throw new AppError("Only event creator can update", 403);
  }

  return await eventRepo.updateEvent(id, data);
};



//  DELETE (CREATOR + ADMIN)
exports.deleteEvent = async (id, req) => {

  const event = await eventRepo.findById(id);

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  const isOwner = event.createdBy.toString() === req.user.id;

  const isAdmin = [
    "secretary",
    "chairman",
    "treasurer",
    "committee_member"
  ].includes(req.user.societyRole); //  FIXED

  // CORRECT LOGIC
  if (!isOwner && !isAdmin) {
    throw new AppError("Not authorized to delete the event", 403);
  }

  return await eventRepo.deleteEvent(id);
};