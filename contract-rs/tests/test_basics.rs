use near_api::types::{AccountId, NearToken};
use near_sdk::near;
use serde_json::json;

#[tokio::test]
async fn test_contract_is_operational() -> testresult::TestResult<()> {
    // Initialize the sandbox
    let sandbox = near_sandbox::Sandbox::start_sandbox().await?;
    let sandbox_network =
        near_api::NetworkConfig::from_rpc_url("sandbox", sandbox.rpc_addr.parse()?);

    // Build the contract
    let contract_wasm_path = cargo_near_build::build_with_cli(Default::default())?;
    let contract_wasm = std::fs::read(contract_wasm_path)?;

    // Create accounts
    let alice = create_subaccount(&sandbox, "alice.sandbox").await?;
    let bob = create_subaccount(&sandbox, "bob.sandbox").await?;
    let contract = create_subaccount(&sandbox, "gbook.sandbox")
        .await?
        .as_contract();

    // Initialize signer for the contract deployment
    let signer = near_api::Signer::from_secret_key(
        near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY
            .parse()
            .unwrap(),
    )?;

    // Deploy the base contract
    near_api::Contract::deploy(contract.account_id().clone())
        .use_code(contract_wasm)
        .without_init_call()
        .with_signer(signer.clone())
        .send_to(&sandbox_network)
        .await?
        .assert_success();

    let _ = contract
        .call_function("add_message", json!({"text": "Hello World!"}))
        .transaction()
        .deposit(NearToken::from_near(0))
        .with_signer(alice.account_id().clone(), signer.clone())
        .send_to(&sandbox_network)
        .await?
        .assert_success();

    let _ = contract
        .call_function("add_message", json!({"text": "Hello Near!"}))
        .transaction()
        .deposit(NearToken::from_near(1))
        .with_signer(bob.account_id().clone(), signer.clone())
        .send_to(&sandbox_network)
        .await?
        .assert_success();

    #[derive(Debug, PartialEq)]
    #[near(serializers = [json])]
    struct PostedMessage {
        premium: bool,
        sender: AccountId,
        text: String,
    }

    let messages_vec: Vec<PostedMessage> = contract
        .call_function("get_messages", json!({}))
        .read_only()
        .fetch_from(&sandbox_network)
        .await?
        .data;

    assert_eq!(
        messages_vec,
        vec![
            PostedMessage {
                premium: false,
                sender: alice.account_id().clone(),
                text: "Hello World!".to_string(),
            },
            PostedMessage {
                premium: true,
                sender: bob.account_id().clone(),
                text: "Hello Near!".to_string(),
            },
        ]
    );

    Ok(())
}

async fn create_subaccount(
    sandbox: &near_sandbox::Sandbox,
    name: &str,
) -> testresult::TestResult<near_api::Account> {
    let account_id: AccountId = name.parse().unwrap();
    sandbox
        .create_account(account_id.clone())
        .initial_balance(NearToken::from_near(10))
        .send()
        .await?;
    Ok(near_api::Account(account_id))
}
