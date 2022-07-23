const express = require("express");
const bodyParser = require("body-parser");
const { Op, QueryTypes } = require("sequelize");
const { sequelize } = require("./model");
const { getProfile } = require("./middleware/getProfile");
const app = express();
app.use(bodyParser.json());
app.set("sequelize", sequelize);
app.set("models", sequelize.models);

/**
 * FIX ME!
 * @returns contract by id
 */
app.get("/contracts/:id", getProfile, async (req, res) => {
  const { Contract } = req.app.get("models");
  const { id } = req.params;

  const { id: profileID } = req.profile;

  const contract = await Contract.findOne({ where: { id } });

  if (!contract) return res.status(404).end();

  if (![contract.ContractorId, contract.ClientId].includes(profileID)) {
    return res.status(401).end();
  }
  res.json(contract);
});

// GET Returns a list of contracts belonging to a user (client or contractor), the list should only contain non terminated contracts.
app.get("/contracts", getProfile, async (req, res) => {
  const { Contract } = req.app.get("models");

  const { id: profileID } = req.profile;
  try {
    const contracts = await Contract.getActiveContractsByUser(profileID);

    res.json(contracts);
  } catch (error) {
    console.log(error);
    return res.status(500).end();
  }
});

// GET /jobs/unpaid - Get all unpaid jobs for a user (either a client or contractor), for active contracts only.
app.get("/jobs/unpaid", getProfile, async (req, res) => {
  const { Contract, Job } = req.app.get("models");

  const { id: profileID } = req.profile;
  try {
    const contracts = await Contract.getActiveContractsByUser(profileID);
    Job.findAll({
      where: {
        ContractId: contracts.map(({ id }) => id),
        paid: false,
      },
    });
    res.json(contracts);
  } catch (error) {
    return res.status(500).end();
  }
});

// Pay for a job, a client can only pay if his balance >= the amount to pay. The amount should be moved from the client's balance to the contractor balance.
app.post("/jobs/:job_id/pay", getProfile, async (req, res) => {
  const { Contract, Job } = req.app.get("models");

  const { type, balance } = req.profile;
  if (type !== "client") {
    // Note: only clients are supposed to pay for a job.
    return res.status(400).json({
      error: "only clients are supposed to pay for a job.",
    });
  }

  try {
    const { job_id: jobId } = req.params;
    const job = await Job.findByPk(jobId, { include: Contract });

    if (job.paid) {
      return res.status(400).json({
        error: "The job is already paid.",
      });
    }

    await job.payForContractor(balance);

    return res.status(200).json(await job.reload());
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
});

// Deposits money into the the the balance of a client, a client can't deposit more than 25% his total of jobs to pay. (at the deposit moment)
app.post("/balances/deposit/:userId", getProfile, async (req, res) => {
  const { Contract, Job, Profile } = req.app.get("models");

  try {
    const { userId: destinationProfileId } = req.params;
    const { amount } = req.body;

    if (amount <= 0) {
      return res.status(400).json({
        error: "Amount must be positive number",
      });
    }
    const destinationProfile = await Profile.findByPk(destinationProfileId);

    if (req.profile.type !== "client" || destinationProfile.type !== "client") {
      return res.status(400).json({
        error: "Only Clients allowed to deposit money to another client",
      });
    }

    const activeContracts = await Contract.getActiveContractsByUser(
      req.profile.id
    );

    const totalAmountOfUnpaidJobs = await Job.sum("price", {
      where: {
        ContractId: activeContracts.map(({ id }) => id),
        paid: {
          [Op.or]: {
            [Op.eq]: false,
            [Op.is]: null,
          },
        },
      },
    });

    const MAX_DEPOSIT_PERCENTAGE = 0.25;
    const maxDepositAmount = totalAmountOfUnpaidJobs * MAX_DEPOSIT_PERCENTAGE;

    if (amount > maxDepositAmount) {
      return res.status(400).json({
        error: `Deposit amount is more than 25%(${maxDepositAmount}) of the unpaid jobs`,
      });
    }

    await req.profile.deposit(destinationProfile, amount);

    return res.status(200).json(await req.profile.reload());
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
});

// Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.
app.get("/admin/best-profession", getProfile, async (req, res) => {
  try {
    const sequelize = req.app.get("sequelize");
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: "start, end is required",
      });
    }

    const query = `

   SELECT *, MAX(price) AS bestProfession from Jobs WHERE paid = 1 AND (paymentDate BETWEEN $1 and $2) GROUP by ContractId ORDER BY  bestProfession DESC LIMIT 0, 1
`;
    const [results] = await sequelize.query(query, {
      bind: [start, end],
      type: QueryTypes.SELECT,
    });

    res.status(200).json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message || error });
  }
});

// GET /admin/best-clients?start=<date>&end=<date>&limit=<integer> - returns the clients the paid the most for jobs in the query time period. limit query parameter should be applied, default limit is 2.
app.get("/admin/best-clients", getProfile, async (req, res) => {
  try {
    const sequelize = req.app.get("sequelize");
    const { start, end, limit = 2 } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: "start, end is required",
      });
    }

    const query = `
    SELECT  p.id, (p.firstName ||  " " ||  p.lastName) fullName , SUM(j.price) as paid FROM profiles p INNER JOIN Contracts  c ON (p.id = c.ClientId) INNER JOIN Jobs  j on (c.id = j.ContractId) 
    WHERE j.paid = 1
    AND (paymentDate BETWEEN $1 and $2)
    GROUP BY p.id
    ORDER BY j.price DESC
    LIMIT 0, $3
  `;

    const results = await sequelize.query(query, {
      bind: [start, end, limit],
      type: QueryTypes.SELECT,
    });

    res.status(200).json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message || error });
  }
});
module.exports = app;
