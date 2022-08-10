const router = require("express").Router();
const { getAll, getById, depositMoney } = require("./controller");
const { getProfile } = require("../middleware/getProfile");

router.get("/contracts/:id", getProfile, getById);
router.get("/contracts", getProfile, getAll);

router.post("/balances/deposit/:userId", getProfile, depositMoney);

module.exports = router;
