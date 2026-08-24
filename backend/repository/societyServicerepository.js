const SocietyService = require("../models/SocietyService");

class SocietyServiceRepository {

  async assign(serviceId, societyId) {
    return SocietyService.create({ serviceId, societyId });
  }

  async exists(serviceId, societyId) {
    return SocietyService.findOne({ serviceId, societyId });
  }

  async getBySociety(societyId) {
    // The Service model has category, openTime and closeTime — there is
    // no "type" or "timing" field, so the previous projection returned
    // undefined for everything but name and phone.
    return SocietyService.find({ societyId })
      .populate(
        "serviceId",
        "name category phone address openTime closeTime is24Hours isActive"
      )
      .sort({ isEmergency: -1, isRecommended: -1 })
      .lean();
  }

  async getByService(serviceId) {
    return SocietyService.find({ serviceId })
      .populate("societyId", "name city")
      .lean();
  }

  async updateLink(linkId, data) {
    return SocietyService.findByIdAndUpdate(linkId, { $set: data }, { new: true });
  }

  async remove(serviceId, societyId) {
    return SocietyService.findOneAndDelete({ serviceId, societyId });
  }
}

module.exports = new SocietyServiceRepository();