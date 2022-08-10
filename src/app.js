const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./model");
const app = express();
app.use(bodyParser.json());
app.set("sequelize", sequelize);
app.set("models", sequelize.models);

app.use("/", require("./contracts/router"));
app.use("/", require("./jobs/router"));
app.use("/", require("./admin/router"));

module.exports = app;
