import { utils } from "near-api-js";
import { useState, useEffect, useContext } from "react";

import Form from "@/components/Form";
import SignIn from "@/components/SignIn";
import Messages from "@/components/Messages";
import styles from "@/styles/app.module.css";

import { NearContext } from "@/context";
import { GuestbookNearContract } from "@/config";

export default function Home() {
  const { signedAccountId, wallet } = useContext(NearContext);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    getLast10Messages().then((messages) => setMessages(messages.reverse()));
  }, []);

  const getLast10Messages = async () => {
    const total_messages = await wallet.viewMethod({
      contractId: GuestbookNearContract,
      method: "total_messages",
    });
    const from_index = total_messages >= 10 ? total_messages - 10 : 0;
    return wallet.viewMethod({
      contractId: GuestbookNearContract,
      method: "get_messages",
      args: { from_index: String(from_index), limit: "10" },
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    const { fieldset, message, donation } = e.target.elements;

    fieldset.disabled = true;

    // Add message to the guest book
    const deposit = utils.format.parseNearAmount(donation.value);
    wallet.callMethod({
      contractId: GuestbookNearContract,
      method: "add_message",
      args: { text: message.value },
      deposit,
    }).catch(() => {
      // rollback to the current messages
      setMessages(messages);
    });

    await new Promise(resolve => setTimeout(resolve, 300));
    fieldset.disabled = false;
    setMessages([{ sender: signedAccountId, text: message.value, premium: donation.value >= 1 }, ...messages]);
  };

  return (
    <main className={styles.main}>
      <div className="container">
        <h1>📖 NEAR Guest Book</h1>
        {signedAccountId ? (
          <Form onSubmit={onSubmit} currentAccountId={signedAccountId} />
        ) : (
          <SignIn />
        )}
      </div>

      {!!messages.length && <Messages messages={messages} />}
    </main>
  );
}
