const SocietyService = require("../models/SocietyService");

class SocietyServiceRepository {

  async assign(serviceId, societyId) {
    return SocietyService.create({ serviceId, societyId });
  }

  async exists(serviceId, societyId) {
    return SocietyService.findOne({ serviceId, societyId });
  }

  async getBySociety(societyId) {
    return SocietyService.find({ societyId })
      .populate("serviceId", "name type timing phone")
      .lean();
  }

  async getByService(serviceId) {
    return SocietyService.find({ serviceId })
      .populate("societyId", "name city")
      .lean();
  }

  async remove(serviceId, societyId) {
    return SocietyService.findOneAndDelete({ serviceId, societyId });
  }
}

module.exports = new SocietyServiceRepository();