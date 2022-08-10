// GET /jobs/unpaid - Get all unpaid jobs for a user (either a client or contractor), for active contracts only.
const getUnPaid = async (req, res) => {
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
};

// Pay for a job, a client can only pay if his balance >= the amount to pay. The amount should be moved from the client's balance to the contractor balance.
const payForContractor = async (req, res) => {
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
};

module.exports = {
  getUnPaid,
  payForContractor,
};
