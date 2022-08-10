const { QueryTypes } = require("sequelize");

// Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.
const getTopProfession = async (req, res) => {
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
};

// GET /admin/best-clients?start=<date>&end=<date>&limit=<integer> - returns the clients the paid the most for jobs in the query time period. limit query parameter should be applied, default limit is 2.
const getTopClient = async (req, res) => {
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
};

module.exports = {
  getTopProfession,
  getTopClient,
};
