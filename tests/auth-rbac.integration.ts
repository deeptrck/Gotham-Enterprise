import assert from "node:assert/strict";
import test from "node:test";
import { AUTH0_ROLE_CLAIM, canAccessOrganization, getAuth0Roles, getOrganizationId, hasAnyRole, isGothamAdministrator } from "../lib/authClaims";

test("normalizes namespaced Auth0 roles and grants founder administration", () => {
  const user = { sub: "auth0|founder", [AUTH0_ROLE_CLAIM]: ["Founder", " viewer "] };
  assert.deepEqual(getAuth0Roles(user), ["founder", "viewer"]);
  assert.equal(isGothamAdministrator(user), true);
  assert.equal(hasAnyRole(user, ["admin", "founder"]), true);
});

test("supports legacy roles claim but fails closed for missing or malformed roles", () => {
  assert.deepEqual(getAuth0Roles({ roles: "Analyst" }), ["analyst"]);
  assert.equal(isGothamAdministrator({ roles: "viewer" }), false);
  assert.deepEqual(getAuth0Roles({ [AUTH0_ROLE_CLAIM]: { role: "admin" } }), []);
  assert.equal(isGothamAdministrator(null), false);
});

test("accepts supported organization claim variants and denies absent scope", () => {
  assert.equal(getOrganizationId({ org_id: "org_a" }), "org_a");
  assert.equal(getOrganizationId({ organization_id: "org_b" }), "org_b");
  assert.equal(getOrganizationId({ ["https://deeptrack.io/organization_id"]: "org_c" }), "org_c");
  assert.equal(getOrganizationId({}), null);
  assert.equal(canAccessOrganization({ org_id: "org_a" }, "org_a"), true);
  assert.equal(canAccessOrganization({ org_id: "org_a" }, "org_b"), false);
  assert.equal(canAccessOrganization({}, "org_a"), false);
});
