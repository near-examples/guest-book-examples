import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { JsonRpcProvider } from "@near-js/providers";
import {
  NearConnector,
  type NearWalletBase,
  type Plugin,
  type SignAndSendTransactionParams,
} from "@hot-labs/near-connect";
import {
  generateRandomKeyPair,
} from "@near-js/client";
import { Account } from "@near-js/accounts";
import { KeyPair } from "@near-js/crypto";
import { KeyPairSigner } from "@near-js/signers";
import { actionCreators } from "@near-js/transactions";
import type { FinalExecutionOutcome } from "@near-js/types";

interface ViewFunctionParams {
  contractId: string;
  method: string;
  args?: Record<string, unknown>;
}

interface FunctionCallParams {
  contractId: string;
  method: string;
  args?: Record<string, unknown>;
  gas?: string;
  deposit?: string;
}

interface AccessKeyConfig {
  contractId: string;
  allowedMethods: string[];
  allowance?: string;

}


interface StoredKeyData {
  accountId: string;
  publicKey: string;
  privateKey: string;
  contractId: string;
  allowedMethods: string[];
}

interface NearContextValue {
  signedAccountId: string;
  wallet: NearWalletBase | undefined;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  viewFunction: (params: ViewFunctionParams) => Promise<any>;
  callFunction: (params: FunctionCallParams) => Promise<any>;
  provider: JsonRpcProvider;
}

const NearContext = createContext<NearContextValue | undefined>(undefined);

const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });

const LoggingPlugin: Plugin = {
  async signIn(wallet, args, result, next) {
    console.log("[LoggingPlugin] 🔐 Sign In", { wallet: wallet.manifest.name });
    const startTime = Date.now();
    const accounts = await next(args);
    console.log(
      "[LoggingPlugin] ✅ Sign In completed in",
      Date.now() - startTime,
      "ms"
    );
    return result(accounts);
  },

  async signOut(wallet, args, result, next) {
    console.log("[LoggingPlugin] 🚪 Sign Out", {
      wallet: wallet.manifest.name,
    });
    await next(args);
    console.log("[LoggingPlugin] ✅ Sign Out completed");
    return result(undefined);
  },

  async signAndSendTransaction(_wallet, tx, result, next) {
    console.log("[LoggingPlugin] 📤 Transaction", {
      receiverId: tx.receiverId,
      actionsCount: tx.actions?.length,
    });
    const startTime = Date.now();
    const outcome = await next(tx);
    console.log(
      "[LoggingPlugin] ✅ Transaction completed in",
      Date.now() - startTime,
      "ms"
    );
    return result(outcome);
  },

  async signAndSendTransactions(_wallet, params, result, next) {
    console.log("[LoggingPlugin] 📤 Transactions", {
      count: params.transactions?.length,
    });
    const startTime = Date.now();
    const outcomes = await next(params);
    console.log(
      "[LoggingPlugin] ✅ Transactions completed in",
      Date.now() - startTime,
      "ms"
    );
    return result(outcomes);
  },

  async signMessage(_wallet, params, result, next) {
    console.log("[LoggingPlugin] ✍️ Sign Message", {
      message: params.message,
      recipient: params.recipient,
    });
    const startTime = Date.now();
    const signed = await next(params);
    console.log(
      "[LoggingPlugin] ✅ Message signed in",
      Date.now() - startTime,
      "ms"
    );
    return result(signed);
  },
};

export const AccessKeyPlugin = (config: AccessKeyConfig): Plugin => {
  const STORAGE_KEY = `access_key_${config.contractId}`;
  const allowance = config.allowance || "250000000000000000000000";
  // Helper: Get stored access key
  const getStoredKey = (): StoredKeyData | null => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  };

  // Helper: Store access key
  const storeKey = (keyData: StoredKeyData): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keyData));
  };

  // Helper: Clear stored access key
  const clearKey = (): void => {
    localStorage.removeItem(STORAGE_KEY);
  };

  // Helper: Check if transaction matches access key criteria
  const shouldUseAccessKey = (tx: SignAndSendTransactionParams): boolean => {
    if (tx.receiverId !== config.contractId) return false;

    for (const action of tx.actions) {
      if (action.type !== "FunctionCall") return false;
      if (!config.allowedMethods.includes(action.params.methodName)) return false;
    }

    return true;
  };

  // Helper: Sign transaction locally using stored key
  const signTransactionLocally = async (
    tx: SignAndSendTransactionParams,
    network: "mainnet" | "testnet" = "testnet"
  ): Promise<FinalExecutionOutcome> => {
    const keyData = getStoredKey();
    if (!keyData) {
      throw new Error("No access key found. Please sign in again.");
    }

    // Create RPC provider for the network (use same provider for verification and transaction)
    const rpcProvider = new JsonRpcProvider({
      url: network === "mainnet"
        ? "https://rpc.mainnet.near.org"
        : "https://test.rpc.fastnear.com"
    });

    // Verify the key exists on-chain before attempting to use it
    try {
      const keyInfo: any = await rpcProvider.query({
        request_type: "view_access_key",
        account_id: keyData.accountId,
        public_key: keyData.publicKey,
        finality: "final",
      });

      console.log("[AccessKeyPlugin] Access key verified on-chain:", keyInfo);

      // Check if the key has enough allowance
      if (keyInfo.permission?.FunctionCall) {
        const allowanceLeft = keyInfo.permission.FunctionCall.allowance;
        console.log("[AccessKeyPlugin] Allowance left:", allowanceLeft);

        if (allowanceLeft === "0" || allowanceLeft === 0) {
          console.warn("[AccessKeyPlugin] Access key has no allowance left");
          clearKey();
          throw new Error("Access key has no allowance left. Please sign in again.");
        }
      }
    } catch (error) {
      console.error("[AccessKeyPlugin] Access key verification failed:", error);
      console.error("[AccessKeyPlugin] Key details:", {
        accountId: keyData.accountId,
        publicKey: keyData.publicKey,
        network
      });
      clearKey();
      throw new Error(`Access key not found on ${network}. Please sign in again. Original error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Create key pair from stored private key
    const keyPair = KeyPair.fromString(keyData.privateKey as any);

    // Create signer from key pair
    const signer = new KeyPairSigner(keyPair);

    // Create account instance
    const account = new Account(keyData.accountId, rpcProvider, signer);

    // Convert actions to NEAR API format using functionCall helper
    const actions = tx.actions.map((action) => {
      if (action.type === "FunctionCall") {
        // Serialize args to bytes
        const argsBytes = new TextEncoder().encode(JSON.stringify(action.params.args || {}));

        return actionCreators.functionCall(
          action.params.methodName,
          argsBytes,
          BigInt(action.params.gas || "30000000000000"),
          BigInt(action.params.deposit || "0")
        );
      }
      throw new Error(`Unsupported action type: ${action.type}`);
    });

    // Sign and send transaction using the non-deprecated API
    const result = await account.signAndSendTransaction({
      receiverId: tx.receiverId,
      actions,
    });

    return result as FinalExecutionOutcome;
  };

  return {
    async signIn(wallet, args, result, next) {
      console.log("[AccessKeyPlugin] Creating function access key for:", {
        contractId: config.contractId,
        methods: config.allowedMethods,
        wallet: wallet.manifest.name,
        walletType: wallet.constructor.name,
      });

      // Generate new key pair using modern API
      const keyPair = generateRandomKeyPair("ed25519");
      const publicKey = keyPair.getPublicKey().toString();
      const privateKey = keyPair.toString();

      // // Call wallet signIn (without contractId/methodNames - we'll add the key manually)
      // const accounts = await next(args);
      //       const modifiedArgs = {
      //   ...args,
      //   contractId: args?.contractId || config.contractId,
      //   methodNames: args?.methodNames || config.allowedMethods || [],
      // };

      const accounts = await next(args);

      if (accounts.length > 0) {
        const accountId = accounts[0].accountId;

        try {
          console.log("[AccessKeyPlugin] Adding access key to account on-chain...", {
            accountId,
            publicKey,
            contractId: config.contractId,
            allowance,
            methodNames: config.allowedMethods,
          });

          const addKeyAction = {
            type: "AddKey" as const,
            params: {
              publicKey,
              accessKey: {
                permission: {
                  receiverId: config.contractId,
                  allowance,
                  methodNames: config.allowedMethods,
                },
              },
            },
          };

          console.log("[AccessKeyPlugin] 🔍 Action being sent:", JSON.stringify(addKeyAction, null, 2));

          const outcome = await wallet.signAndSendTransaction({
            signerId: accountId,
            receiverId: accountId,
            actions: [addKeyAction],
            network: args?.network || "testnet",
          });

          console.log("[AccessKeyPlugin] Transaction outcome:", outcome);

          // Verify the transaction was successful
          if (outcome && (outcome as any).status && 
              (typeof (outcome as any).status === 'object' && 'SuccessValue' in (outcome as any).status || 
               typeof (outcome as any).status === 'object' && 'SuccessReceiptId' in (outcome as any).status)) {
            
            console.log("[AccessKeyPlugin] ✅ Transaction successful, waiting for key to be available...");
            
            // Wait for the key to be available on-chain before saving it
            // Try up to 10 times with 1 second delay
            let keyAvailable = false;
            for (let attempt = 0; attempt < 10; attempt++) {
              try {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                
                const keyInfo: any = await provider.query({
                  request_type: "view_access_key",
                  account_id: accountId,
                  public_key: publicKey,
                  finality: "final",
                });
                
                console.log(`[AccessKeyPlugin] Key found on-chain (attempt ${attempt + 1}):`, keyInfo);
                keyAvailable = true;
                break;
              } catch (error) {
                console.log(`[AccessKeyPlugin] Key not yet available (attempt ${attempt + 1})`);
              }
            }
            
            if (!keyAvailable) {
              console.warn("[AccessKeyPlugin] ⚠️ Key created but not yet visible on-chain, saving anyway");
            }
            
            // Store the key pair for later use
            storeKey({
              accountId,
              publicKey,
              privateKey,
              contractId: config.contractId,
              allowedMethods: config.allowedMethods,
            });

            console.log("[AccessKeyPlugin] ✅ Access key created on-chain and stored locally");
          } else {
            throw new Error("Transaction did not complete successfully");
          }
        } catch (error) {
          console.error("[AccessKeyPlugin] ❌ Failed to create access key:", error);
          throw new Error(`Failed to create access key: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return result(accounts);
    },

    async signOut(_wallet, args, result, next) {
      console.log("[AccessKeyPlugin] Clearing stored access key");
      clearKey();
      await next(args);
      return result(undefined);
    },

    async signAndSendTransaction(_wallet, tx, result, next) {
      // Check if this transaction can use the access key
      if (shouldUseAccessKey(tx)) {
        console.log("[AccessKeyPlugin] 🔑 Using local access key to sign transaction");
        console.log(tx);
        
        try {
          const outcome = await signTransactionLocally(tx, tx.network);
          console.log("[AccessKeyPlugin] ✅ Transaction signed locally");
          return result(outcome);
        } catch (error) {
          console.error("[AccessKeyPlugin] ❌ Failed to sign locally, falling back to wallet:", error);
          // Fall back to wallet if local signing fails
        }
      }

      // Pass to wallet for transactions that don't match criteria
      console.log("[AccessKeyPlugin] Passing transaction to wallet");
      const outcome = await next(tx);
      return result(outcome);
    },
  };
};

// const AccessKeyPlugin = (config: AccessKeyConfig): Plugin => {
//   const checkFunctionCallKey = async (accountId: string, publicKey: string) => {
//     try {
//       const result: any = await provider.query({
//         request_type: "view_access_key",
//         account_id: accountId,
//         public_key: publicKey,
//         finality: "final",
//       });
//       console.log("[AccessKeyPlugin] Access key info:", result);

//       if (result.permission === "FullAccess") {
//         return false;
//       }

//       if (result.permission?.FunctionCall?.receiver_id === config.contractId) {
//         return true;
//       }

//       return false;
//     } catch {
//       return false;
//     }
//   };

//   return {
//     async signIn(wallet, args, result, next) {
//       const modifiedArgs = {
//         ...args,
//         contractId: args?.contractId || config.contractId,
//         methodNames: args?.methodNames || config.allowedMethods || [],
//       };

//       const accounts = await next(args);

//       if (accounts?.[0]) {
//         const accountId = accounts[0].accountId;

//         const keyPair = KeyPair.fromRandom("ed25519");
//         const newPublicKey = keyPair.getPublicKey().toString();
//         const privateKey = keyPair.toString();

//         const keyData = {
//           accountId,
//           publicKey: newPublicKey,
//           privateKey,
//           contractId: config.contractId,
//           allowedMethods: config.allowedMethods,
//         };

//         console.log(
//           "[AccessKeyPlugin] Adding access key to account:",
//           newPublicKey
//         );

//         try {
//           await wallet.signAndSendTransaction({
//             receiverId: accountId,
//             actions: [
//               {
//                 type: "AddKey",
//                 params: {
//                   publicKey: newPublicKey,
//                   accessKey: {
//                     permission: {
//                       receiverId: config.contractId,
//                       methodNames: config.allowedMethods || [],
//                       allowance: "250000000000000",
//                     },
//                   },
//                 },
//               },
//             ],
//           });

//           // Only save to localStorage after successful transaction
//           localStorage.setItem(`manual_key`, JSON.stringify(keyData));
//           console.log(
//             "[AccessKeyPlugin] Access key added successfully and saved to localStorage"
//           );
//         } catch (e) {
//           console.log(
//             "[AccessKeyPlugin] Failed to add access key on-chain:",
//             e
//           );
//           // Don't save to localStorage if transaction failed
//           throw e; // Re-throw to prevent sign in from completing
//         }
//         // // Check wallet's public key
//         // const walletAccounts = await wallet.getAccounts();
//         // const publicKey = walletAccounts?.[0]?.publicKey;

//         // console.log("[AccessKeyPlugin] Checking for function-call key:", accountId, publicKey);
//         // const hasFunctionCallKey = await checkFunctionCallKey(accountId, publicKey);
//         // console.log("[AccessKeyPlugin] Function-call key exists:", hasFunctionCallKey);

//         // if (!hasFunctionCallKey) {
//         //   const keyPair = KeyPair.fromRandom('ed25519');
//         //   const newPublicKey = keyPair.getPublicKey().toString();
//         //   const privateKey = keyPair.toString();

//         //   const keyData = {
//         //     accountId,
//         //     publicKey: newPublicKey,
//         //     privateKey,
//         //     contractId: config.contractId,
//         //     allowedMethods: config.allowedMethods
//         //   };

//         //   console.log("[AccessKeyPlugin] Adding access key to account:", newPublicKey,typeof wallet,wallet);

//         //   try{
//         //     await wallet.signAndSendTransaction({
//         //       receiverId: accountId,
//         //       actions: [{
//         //         type: "AddKey",
//         //         params: {
//         //           publicKey: newPublicKey,
//         //           accessKey: {
//         //             permission: {
//         //               receiverId: config.contractId,
//         //               methodNames: config.allowedMethods || [],
//         //             },
//         //           },
//         //         },
//         //       }],
//         //     });

//         //     // Only save to localStorage after successful transaction
//         //     localStorage.setItem(`manual_key`, JSON.stringify(keyData));
//         //     console.log("[AccessKeyPlugin] Access key added successfully and saved to localStorage");
//         //   }catch(e){
//         //     console.log('[AccessKeyPlugin] Failed to add access key on-chain:', e);
//         //     // Don't save to localStorage if transaction failed
//         //     throw e; // Re-throw to prevent sign in from completing
//         //   }

//         // }
//       }

//       return result(accounts);
//     },

//     async signOut(wallet, args, result, next) {
//       localStorage.removeItem(`manual_key`);
//       await next(args);
//       return result(undefined);
//     },
//   };
// };

const connector = new NearConnector({
  network: "testnet",
  logger: {
    log: (...logs) => console.log("[HOT-CONNECTOR]", ...logs),
  },
});

connector.use(LoggingPlugin);
connector.use(
  AccessKeyPlugin({
    contractId: "guestbook.near-examples.testnet",
    allowedMethods: ["add_message"],
  })
);
export function NearProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<NearWalletBase | undefined>(undefined);
  const [signedAccountId, setSignedAccountId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initializeConnector() {
      const connectedWallet = await connector
        .getConnectedWallet()
        .catch(() => null);

      if (connectedWallet) {
        setWallet(connectedWallet.wallet);
        setSignedAccountId(connectedWallet.accounts[0].accountId);
      }

      const onSignOut = () => {
        setWallet(undefined);
        setSignedAccountId("");
      };

      const onSignIn = async (payload: { wallet: NearWalletBase }) => {
        setWallet(payload.wallet);
        const accounts = await payload.wallet.getAccounts();
        setSignedAccountId(accounts[0]?.accountId || "");
      };

      connector.on("wallet:signOut", onSignOut);
      connector.on("wallet:signIn", onSignIn);
      setLoading(false);
    }

    initializeConnector();

    return () => {
      if (connector) {
        connector.removeAllListeners("wallet:signOut");
        connector.removeAllListeners("wallet:signIn");
      }
    };
  }, []);

  async function signIn() {
    if (!connector) return;
    console.log("test");
    const wallet = await connector.connect();

    console.log("Connected wallet", wallet);
    if (wallet) {
      setWallet(wallet);
      const accounts = await wallet.getAccounts();
      setSignedAccountId(accounts[0]?.accountId || "");
    }
  }

  async function signOut() {
    if (!connector || !wallet) return;
    await connector.disconnect(wallet);
    console.log("Disconnected wallet");

    setWallet(undefined);
    setSignedAccountId("");
  }

  async function viewFunction({
    contractId,
    method,
    args = {},
  }: ViewFunctionParams) {
    return provider.callFunction(contractId, method, args);
  }

  async function callFunction({
    contractId,
    method,
    args = {},
    gas = "30000000000000",
    deposit = "0",
  }: FunctionCallParams) {
    const wallet = await connector.wallet();

    return wallet.signAndSendTransaction({
      signerId: signedAccountId,
      receiverId: contractId,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: method,
            args,
            gas,
            deposit,
          },
        },
      ],
    });
  }

  const value: NearContextValue = {
    signedAccountId,
    wallet,
    signIn,
    signOut,
    loading,
    viewFunction,
    callFunction,
    provider,
  };

  return <NearContext.Provider value={value}>{children}</NearContext.Provider>;
}

export function useNearWallet() {
  const context = useContext(NearContext);
  if (context === undefined) {
    throw new Error("useNear must be used within a NearProvider");
  }
  return context;
}
