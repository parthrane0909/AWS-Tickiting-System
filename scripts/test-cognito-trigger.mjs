// Offline unit checks for the inline Lambda in infrastructure/cognito.yaml.
// Runs without AWS credentials and without npm dependencies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const yaml = readFileSync(new URL('../infrastructure/cognito.yaml', import.meta.url), 'utf8');
const marker = '        ZipFile: |\n';
const beginning = yaml.indexOf(marker);
assert.notEqual(beginning, -1, 'Cognito trigger code must be present in the template');
const snippet = yaml.slice(beginning + marker.length).split('\n');
const source = [];
for (const line of snippet) {
  if (line.trim() && !line.startsWith('          ')) break;
  source.push(line.startsWith('          ') ? line.slice(10) : '');
}
assert.ok(source.length > 6, 'Extracted trigger must contain executable code');

function setup(groups = []) {
  const commands = [];
  class CognitoIdentityProviderClient {
    async send(command) {
      commands.push(command);
      return command.name === 'AdminListGroupsForUserCommand'
        ? { Groups: groups.map(GroupName => ({ GroupName })) }
        : {};
    }
  }
  const mocks = {
    CognitoIdentityProviderClient,
    AdminListGroupsForUserCommand: class {
      constructor(input) { this.name = 'AdminListGroupsForUserCommand'; this.input = input; }
    },
    AdminAddUserToGroupCommand: class {
      constructor(input) { this.name = 'AdminAddUserToGroupCommand'; this.input = input; }
    }
  };
  const exports = {};
  vm.runInNewContext(source.join('\n'), { exports, require: () => mocks }, { timeout: 1000 });
  return { handler: exports.handler, commands };
}
const event = () => ({
  triggerSource: 'PostConfirmation_ConfirmSignUp',
  userPoolId: 'ap-south-1_POC_POOL',
  userName: 'new-customer'
});

test('confirmed self-signup receives Customer group, never Agent', async () => {
  const { handler, commands } = setup([]);
  const input = event();
  assert.equal(await handler(input), input);
  assert.deepEqual(commands.map(x => x.name), [
    'AdminListGroupsForUserCommand', 'AdminAddUserToGroupCommand'
  ]);
  assert.equal(commands[1].input.GroupName, 'Customer');
  assert.equal(commands[1].input.UserPoolId, input.userPoolId);
  assert.equal(commands[1].input.Username, input.userName);
});

test('already Customer: idempotent, no extra group writes', async () => {
  const { handler, commands } = setup(['Customer']);
  await handler(event());
  assert.equal(commands.length, 1);
});

test('already Agent: never add Customer role', async () => {
  const { handler, commands } = setup(['Agent']);
  await handler(event());
  assert.equal(commands.length, 1);
});

test('forgot-password trigger is ignored', async () => {
  const { handler, commands } = setup([]);
  await handler({ ...event(), triggerSource: 'PostConfirmation_ConfirmForgotPassword' });
  assert.equal(commands.length, 0);
});

test('malformed identity is rejected without assigning group', async () => {
  const { handler, commands } = setup([]);
  await assert.rejects(handler({ ...event(), userName: '' }), /Missing Cognito identity/);
  assert.equal(commands.length, 0);
});
