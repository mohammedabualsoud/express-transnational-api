const { Op } = require("sequelize");

const getById = async (req, res) => {
  const { Contract } = req.app.get("models");
  const { id } = req.params;

  const { id: profileID } = req.profile;

  const contract = await Contract.findOne({ where: { id } });

  if (!contract) return res.status(404).end();

  if (![contract.ContractorId, contract.ClientId].includes(profileID)) {
    return res.status(401).end();
  }
  res.json(contract);
};

// GET Returns a list of contracts belonging to a user (client or contractor), the list should only contain non terminated contracts.
const getAll = async (req, res) => {
  const { Contract } = req.app.get("models");

  const { id: profileID } = req.profile;
  try {
    const contracts = await Contract.getActiveContractsByUser(profileID);

    res.json(contracts);
  } catch (error) {
    console.log(error);
    return res.status(500).end();
  }
};

// Deposits money into the the the balance of a client, a client can't deposit more than 25% his total of jobs to pay. (at the deposit moment)
const depositMoney = async (req, res) => {
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
};

module.exports = {
  getById,
  getAll,
  depositMoney,
};
