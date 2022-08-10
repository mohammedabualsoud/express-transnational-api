const router = require("express").Router();
const { payForContractor, getUnPaid } = require("./controller");
const { getProfile } = require("../middleware/getProfile");

router.get("/jobs/unpaid", getProfile, getUnPaid);
router.post("/jobs/:job_id/pay", getProfile, payForContractor);

module.exports = router;
