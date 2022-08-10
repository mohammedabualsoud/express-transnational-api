const router = require("express").Router();
const { getTopClient, getTopProfession } = require("./controller");
const { getProfile } = require("../middleware/getProfile");

router.get("/admin/best-profession", getProfile, getTopProfession);

router.get("/admin/best-clients", getProfile, getTopClient);

module.exports = router;
