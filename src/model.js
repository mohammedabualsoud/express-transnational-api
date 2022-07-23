const Sequelize = require("sequelize");
const { Op } = Sequelize;
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite3",
});

class Profile extends Sequelize.Model {
  async deposit(destinationClient, amount) {
    const t = await sequelize.transaction();

    try {
      await Promise.all([
        Profile.decrement(
          { balance: amount },
          { where: { id: this.id }, transaction: t }
        ),
        Profile.increment(
          { balance: amount },
          { where: { id: destinationClient.id }, transaction: t }
        ),
      ]);

      return await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
}
Profile.init(
  {
    firstName: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    lastName: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    profession: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    balance: {
      type: Sequelize.DECIMAL(12, 2),
    },
    type: {
      type: Sequelize.ENUM("client", "contractor"),
    },
  },
  {
    sequelize,
    modelName: "Profile",
  }
);

class Contract extends Sequelize.Model {
  static async getActiveContractsByUser(profileID) {
    return await Contract.findAll({
      where: {
        status: { [Op.ne]: "terminated" },
        [Op.or]: [{ ClientId: profileID }, { ContractorId: profileID }],
      },
    });
  }
}
Contract.init(
  {
    terms: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    status: {
      type: Sequelize.ENUM("new", "in_progress", "terminated"),
    },
  },
  {
    sequelize,
    modelName: "Contract",
  }
);

class Job extends Sequelize.Model {
  async payForContractor(balance) {
    const { price } = this;
    const { ContractorId, ClientId } = this.Contract;

    if (balance < price) {
      throw new Error("Client balance is not enough");
    }

    if (this.Contract.status !== "in_progress") {
      throw new Error("The Contract is not in active status");
    }
    const t = await sequelize.transaction();

    try {
      await Promise.all([
        Profile.decrement(
          { balance: price },
          { where: { id: ClientId }, lock: true, transaction: t }
        ),
        Profile.increment(
          { balance: price },
          { where: { id: ContractorId }, lock: true, transaction: t }
        ),
        this.update(
          { paid: true, paymentDate: new Date() },

          { transaction: t, lock: true }
        ),
        this.Contract.update(
          { status: "terminated" },
          { transaction: t, lock: true }
        ),
      ]);

      return await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
}
Job.init(
  {
    description: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    price: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
    },
    paid: {
      type: Sequelize.BOOLEAN,
      default: false,
    },
    paymentDate: {
      type: Sequelize.DATE,
    },
  },
  {
    sequelize,
    modelName: "Job",
  }
);

Profile.hasMany(Contract, { as: "Contractor", foreignKey: "ContractorId" });
Contract.belongsTo(Profile, { as: "Contractor" });
Profile.hasMany(Contract, { as: "Client", foreignKey: "ClientId" });
Contract.belongsTo(Profile, { as: "Client" });
Contract.hasMany(Job);
Job.belongsTo(Contract);

module.exports = {
  sequelize,
  Profile,
  Contract,
  Job,
};
