const contractPerNetwork = {
	mainnet: "guestbook.near-examples.near",
	testnet: "guestbook.near-examples.testnet",
};

export const NetworkId = "testnet";
export const GuestbookNearContract = contractPerNetwork[NetworkId];
