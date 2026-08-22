const service=require("../services/expenseService");
const {createExpenseSchema,toggleVisibilitySchema}=require("../validation/expenseValidation");

//create expense
exports.createExpense=async(req,res)=>{
    try{
        const {error}=createExpenseSchema.validate(req.body);
        if(error){
            return res.status(400).json({message:error.details[0].message});
        }
        const data=await service.createExpense(req);
        res.json({success:true,data});
    }catch(err){
        res.status(err.statusCode||500).json({message:err.message});
    }
};

//  GET EXPENSES
exports.getExpenses = async (req, res) => {
  try {
    const data = await service.getExpenses(req);

    res.json({
      success: true,
      data
    });

  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
};


//  PUBLISH EXPENSE
exports.publishExpense = async (req, res) => {
  try {
    const data = await service.publishExpense(req.params.id, req);

    res.json({
      success: true,
      data
    });

  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
};


//  TOGGLE VISIBILITY
exports.toggleVisibility = async (req, res) => {
  try {
    const { error } = toggleVisibilitySchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const data = await service.toggleVisibility(
      req.params.id,
      req.body.visible,
      req
    );

    res.json({
      success: true,
      data
    });

  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });
  }
};