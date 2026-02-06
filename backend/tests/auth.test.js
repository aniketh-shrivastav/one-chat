const request = require("supertest");
const mongoose = require("mongoose");
const appFactory = require("../server"); // server exports running server; we adapt by requiring express app if refactored

// NOTE: Current server.js starts the server immediately; for a tighter test harness you'd
// export the app separately. For now we will hit http://localhost:5000 directly.
// These tests assume the dev server is running before executing `npm test`.

const BASE = "http://localhost:5000";

describe("Auth flow (basic smoke)", () => {
  test("signup then login with name & age", async () => {
    const email = `user_${Date.now()}@example.com`;
    const username = `tester_${Date.now()}`;
    const signup = await request(BASE)
      .post("/api/auth/signup")
      .send({
        username,
        name: "Test User",
        age: 25,
        email,
        password: "Passw0rd",
      })
      .expect(201);
    expect(signup.body.token).toBeDefined();
    expect(signup.body.user).toBeDefined();
    expect(signup.body.user.name).toBe("Test User");

    const login = await request(BASE)
      .post("/api/auth/login")
      .send({ email, password: "Passw0rd" })
      .expect(200);
    expect(login.body.token).toBeDefined();
    expect(login.body.user.name).toBe("Test User");
  });

  test("duplicate username rejected", async () => {
    const email1 = `dup1_${Date.now()}@example.com`;
    const email2 = `dup2_${Date.now()}@example.com`;
    const uname = `dupuser_${Date.now()}`;
    await request(BASE)
      .post("/api/auth/signup")
      .send({
        username: uname,
        name: "Dup User",
        age: 30,
        email: email1,
        password: "Passw0rd",
      })
      .expect(201);
    const dup = await request(BASE)
      .post("/api/auth/signup")
      .send({
        username: uname,
        name: "Dup User2",
        age: 31,
        email: email2,
        password: "Passw0rd",
      })
      .expect(400);
    expect(dup.body.msg).toMatch(/Username already in use|username/i);
  });
});
