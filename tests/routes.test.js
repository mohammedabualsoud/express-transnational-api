const request = require("supertest");
const app = require("../src/app");

describe("GET Endpoints", () => {
  describe("/contracts/:id", () => {
    it("When profile_id not passed in the http header, Should return 401", async () => {
      const res = await request(app).get("/contracts/1").send();
      expect(res.statusCode).toEqual(401);
    });
  });
});
