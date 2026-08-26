const fs = require('fs');
const assert = require('assert');
const files = [
  'app/api/scans/route.ts',
  'app/api/results/route.ts',
  'app/api/results/[id]/route.ts',
  'app/api/results/[id]/feedback/route.ts',
  'lib/gothamModel.ts',
  'lib/repositories/users.ts',
  'lib/repositories/operationalRepositories.ts',
  'middleware.ts',
  'package.json',
];
const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
for (const forbidden of ['RealityDefender', 'realitydefender', 'FakeCatcher', 'fakecatcher', 'BACKEND_API_URL', 'NEXT_PUBLIC_API_BASE_URL', 'legacy video backend', 'rd-only']) {
  assert(!source.includes(forbidden), `Forbidden legacy symbol remains: ${forbidden}`);
}
assert(source.includes('beginModelInvocation'), 'SageMaker invocation helper is not wired');
assert(source.includes('completeModelInvocation'), 'SageMaker completion helper is not wired');
assert(fs.readFileSync('db/postgres/002_enterprise_operational.sql', 'utf8').includes('model_invocations_org_idempotency_idx'));
assert(fs.readFileSync('db/postgres/002_enterprise_operational.sql', 'utf8').includes('usage_events_org_idempotency_idx'));
assert(fs.readFileSync('lib/repositories/users.ts', 'utf8').includes('idempotency_key'));
console.log('model hardening contract checks passed');
