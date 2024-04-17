import styles from '@/styles/app.module.css';
import { useEffect } from 'react';
import { useStore } from "@/layout";
import Messages from '@/components/Messages';
import { useState } from 'react';
import SignIn from '@/components/SignIn';
import Form from '@/components/Form';
import { utils } from 'near-api-js';
import { GuestbookNearContract } from '@/config';

const CONTRACT_NAME = GuestbookNearContract


export default function Home() {
  const { signedAccountId, wallet } = useStore();
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const initFunction = async () => {
      const messages = await getLast10Messages();
      setMessages(messages.reverse());
    }
    initFunction();
  }, [wallet]);

  const getLast10Messages = async () => {
    if(!wallet) return [];
    const total_messages = await wallet.viewMethod({ contractId: CONTRACT_NAME, method: "total_messages" });
    const from_index = total_messages >= 10 ? total_messages - 10 : 0;
    return wallet.viewMethod({ contractId: CONTRACT_NAME, method: "get_messages", args: { from_index: String(from_index), limit: "10" } });
  }

  const onSubmit = async (e) => {
    e.preventDefault();

    const { fieldset, message, donation } = e.target.elements;

    fieldset.disabled = true;

    // Add message to the guest book
    const deposit = utils.format.parseNearAmount(donation.value);
    await wallet.callMethod({ contractId: CONTRACT_NAME, method: "add_message", args: { text: message.value }, deposit });

    // Get updated messages
    const messages = await getLast10Messages();
    setMessages(messages.reverse());

    message.value = '';
    donation.value = '0';
    fieldset.disabled = false;
    message.focus();
  };

  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    setLoggedIn(!!signedAccountId);
  }, [signedAccountId]);
  return (
    <main className={styles.main}>
      
      <div className="container">
      <h1>📖 NEAR Guest Book</h1>
      {loggedIn
        ? <Form onSubmit={onSubmit} currentAccountId={wallet.accountId} />
        : <SignIn />
      }
      </div>
  

      {!!messages.length && <Messages messages={messages} />}
    </main>
  );
}