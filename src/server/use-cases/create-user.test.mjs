import assert from "node:assert/strict";
import test from "node:test";

test("createUser hashes password and keeps audit payload free of raw password", async () => {
  const { createUser } = await import("./create-user.ts");

  let savedInput;
  let auditInput;
  const result = await createUser(
    {
      actorId: "7f23d991-fb8a-4794-8d7e-c91331a64a93",
      name: "新成员",
      email: "member@example.com",
      password: "StrongPassword123",
      role: "creative",
    },
    {
      upsert: async (input) => {
        savedInput = input;
        return {
          id: "1ab5f5ef-3c01-4b36-9b1b-45405da88c10",
          name: input.name,
          email: input.email.toLowerCase(),
          role: input.role,
          isActive: true,
        };
      },
      audit: async (input) => {
        auditInput = input;
      },
      hash: async (password) => `hashed:${password.length}`,
    }
  );

  assert.equal(result.user.role, "creative");
  assert.equal(savedInput.passwordHash, "hashed:17");
  assert.equal(auditInput.after.password, undefined);
  assert.equal(auditInput.after.passwordHash, undefined);
  assert.equal(auditInput.after.email, "member@example.com");
});
