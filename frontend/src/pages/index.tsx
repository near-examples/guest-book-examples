import { utils } from "near-api-js";
import { useState, useEffect, FormEvent } from "react";

import Form from "@/components/Form";
import SignIn from "@/components/SignIn";
import Messages from "@/components/Messages";
import styles from "@/styles/app.module.css";

import { GuestbookNearContract } from "@/config";
import { useNear } from "@/hooks/useNear";

type GuestbookMessage = {
  sender: string | null;
  text: string;
  premium: boolean;
};

export default function Home() {
  const { signedAccountId, viewFunction, callFunction } = useNear();
  const [messages, setMessages] = useState<GuestbookMessage[]>([]);

  useEffect(() => {
    getLast10Messages().then((msgs) =>
      setMessages(msgs.reverse())
    );
  }, []);

  const getLast10Messages = async (): Promise<GuestbookMessage[]> => {
    const total_messages = (await viewFunction({
      contractId: GuestbookNearContract,
      method: "total_messages",
    })) as number;

    const from_index = total_messages >= 10 ? total_messages - 10 : 0;

    return (await viewFunction({
      contractId: GuestbookNearContract,
      method: "get_messages",
      args: { from_index: String(from_index), limit: "10" },
    })) as GuestbookMessage[];
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const target = e.target as typeof e.target & {
      fieldset: { disabled: boolean };
      message: { value: string };
      donation: { value: string };
    };

    const { fieldset, message, donation } = target;
    fieldset.disabled = true;

    const deposit = utils.format.parseNearAmount(donation.value) || undefined;

    callFunction({
      contractId: GuestbookNearContract,
      method: "add_message",
      args: { text: message.value },
      deposit,
    }).catch(() => {
      // rollback
      setMessages([...messages]);
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
    fieldset.disabled = false;

    setMessages([
      {
        sender: signedAccountId,
        text: message.value,
        premium: parseFloat(donation.value) >= 1,
      },
      ...messages,
    ]);
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

      {messages.length > 0 && <Messages messages={messages} />}
    </main>
  );
}
