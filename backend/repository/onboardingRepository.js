const Draft = require("../models/Drafts");

//  Find active draft for a user
exports.findDraftByUserId = (userId) => {
    return Draft.findOne({
        createdBy: userId,
        status: "draft"
    });
};

//  Find draft by ID
exports.findDraftById = (id) => {
    return Draft.findById(id);
};

//  Find draft by ID and user (ownership + security)
exports.findDraftByIdAndUser = (draftId, userId) => {
    return Draft.findOne({
        _id: draftId,
        createdBy: userId,
        status: "draft"
    });
};

//  Create new draft
exports.createDraft = (data) => {
    return Draft.create(data);
};

//  Update draft
exports.updateDraft = (id, data) => {
    return Draft.findByIdAndUpdate(
        id,
        data,
        {
            new: true,
            runValidators: true
        }
    );
};