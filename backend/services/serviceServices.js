const serviceRepo = require("../repository/servicesRepository");
const societyServiceRepo = require("../repository/societyServiceRepository");

class ServiceService {

  async createService(data) {
    return serviceRepo.create(data);
  }

  async getAllServices() {
    return serviceRepo.getAll();
  }

  async updateService(id, data) {
    return serviceRepo.update(id, data);
  }

  // 🔥 ASSIGN WITH DUPLICATE CHECK
  async assignService(serviceId, societyIds) {

    const results = [];

    for (let societyId of societyIds) {

      const exists = await societyServiceRepo.exists(serviceId, societyId);

      if (exists) {
        continue; // skip duplicate
      }

      const res = await societyServiceRepo.assign(serviceId, societyId);
      results.push(res);
    }

    return results;
  }

  // 🔥 UNASSIGN
  async unassignService(serviceId, societyId) {

    const removed = await societyServiceRepo.remove(serviceId, societyId);

    if (!removed) {
      throw new Error("Service not assigned to this society");
    }

    return removed;
  }

  // 🔥 GET LINKED SOCIETIES
  async getLinkedSocieties(serviceId) {

    const data = await societyServiceRepo.getByService(serviceId);

    return data.map(item => ({
      _id: item.societyId._id,
      name: item.societyId.name,
      city: item.societyId.city
    }));
  }
}

module.exports = new ServiceService();