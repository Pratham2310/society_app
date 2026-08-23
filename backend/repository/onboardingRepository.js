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

//  All drafts a user has in progress. There is at most one active
//  draft per user (step1 reuses it), so this returns 0 or 1 today —
//  but the console lists them, and a list that silently holds one
//  item is easier to grow than a singular endpoint.
exports.findDraftsByUser = (userId) => {
    return Draft.find({
        createdBy: userId,
        status: "draft"
    }).sort({ updatedAt: -1 }).lean();
};

//  Discard a draft. Scoped by user so one salesperson cannot throw
//  away another's half-finished onboarding.
exports.deleteDraftByIdAndUser = (draftId, userId) => {
    return Draft.findOneAndDelete({
        _id: draftId,
        createdBy: userId,
        status: "draft"
    });
};
