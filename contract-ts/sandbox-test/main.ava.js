import anyTest from 'ava';
import { readFileSync } from 'fs';
import { Sandbox, DEFAULT_ACCOUNT_ID, DEFAULT_PRIVATE_KEY } from 'near-sandbox';
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, nearToYocto } from 'near-api-js';

/**
 *  @type {import('ava').TestFn<{sandbox: import('near-sandbox').Sandbox, provider: JsonRpcProvider, root: Account, alice: Account, contract: Account}>}
 */
const test = anyTest;

test.beforeEach(async (t) => {
  // Start a fresh sandbox for each test
  const sandbox = await Sandbox.start({});
  const provider = new JsonRpcProvider({ url: sandbox.rpcUrl });

  // All accounts share the sandbox genesis key for simplicity
  const keyPair = KeyPair.fromString(DEFAULT_PRIVATE_KEY);
  const signer = new KeyPairSigner(keyPair);

  const root = new Account(DEFAULT_ACCOUNT_ID, provider, signer);

  // some test accounts
  await root.createSubAccount({
    accountOrPrefix: 'alice',
    publicKey: keyPair.getPublicKey(),
    nearToTransfer: nearToYocto('30'),
  });
  await root.createSubAccount({
    accountOrPrefix: 'contract',
    publicKey: keyPair.getPublicKey(),
    nearToTransfer: nearToYocto('30'),
  });

  const alice = new Account(`alice.${DEFAULT_ACCOUNT_ID}`, provider, signer);
  const contract = new Account(`contract.${DEFAULT_ACCOUNT_ID}`, provider, signer);

  // Deploy the wasm file passed by the package.json test script
  await contract.deployContract(readFileSync(process.argv[2]));

  // Save state for test runs, it is unique for each test
  t.context = { sandbox, provider, root, alice, contract };
});

test.afterEach.always(async (t) => {
  // Stop the sandbox and clean up temporary files
  await t.context.sandbox.tearDown().catch((error) => {
    console.log('Failed to stop the Sandbox:', error);
  });
});

test("send one message and retrieve it", async (t) => {
  const { provider, root, contract } = t.context;
  await root.callFunction({
    contractId: contract.accountId,
    methodName: "add_message",
    args: { text: "aloha" },
  });

  const msgs = await provider.callFunction({
    contractId: contract.accountId,
    method: "get_messages",
    args: {},
  });
  const expectedMessagesResult = [
    { premium: false, sender: root.accountId, text: "aloha" },
  ];
  t.deepEqual(msgs, expectedMessagesResult);
});

test("send two messages and expect two total", async (t) => {
  const { provider, root, contract, alice } = t.context;
  await root.callFunction({
    contractId: contract.accountId,
    methodName: "add_message",
    args: { text: "aloha" },
  });
  await alice.callFunction({
    contractId: contract.accountId,
    methodName: "add_message",
    args: { text: "hola" },
    deposit: nearToYocto("1"),
  });

  const total_messages = await provider.callFunction({
    contractId: contract.accountId,
    method: "total_messages",
    args: {},
  });
  t.is(total_messages, 2);

  const msgs = await provider.callFunction({
    contractId: contract.accountId,
    method: "get_messages",
    args: {},
  });
  const expected = [
    { premium: false, sender: root.accountId, text: "aloha" },
    { premium: true, sender: alice.accountId, text: "hola" },
  ];

  t.deepEqual(msgs, expected);
});
