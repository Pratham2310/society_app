exports.getPagination=(page=1,limit=20)=>{
    page=parseInt(page);
    limit=parseInt(limit);
    const skip=(page-1)*limit;
    return {
        page,
        limit,
        skip
    };
};