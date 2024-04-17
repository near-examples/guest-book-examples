import { useEffect, useState } from 'react'
import { Wallet } from "./services/near-wallet";
import Form from './components/Form';
import SignIn from './components/SignIn';
import Messages from './components/Messages';
import { utils } from 'near-api-js';

const CONTRACT_NAME = "guestbook.near-examples.testnet"
const wallet = new Wallet({ createAccessKeyFor: CONTRACT_NAME })

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const initFunction = async () => {
      const isSignedIn = await wallet.startUp();
      const messages = await getLast10Messages();
      
      setIsSignedIn(isSignedIn);
      setMessages(messages.reverse());
    }
    initFunction();
  }, []);

  const getLast10Messages = async () => {
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

  const signIn = () => { wallet.signIn() }

  const signOut = () => { wallet.signOut() }

  return (
    <main>
      <table>
        <tr>
          <td><h1>📖 NEAR Guest Book</h1></td>
          <td>{isSignedIn
            ? <button onClick={signOut}>Log out</button>
            : <button onClick={signIn}>Log in</button>
          }</td>
        </tr>
      </table>

      <hr />
      {isSignedIn
        ? <Form onSubmit={onSubmit} currentAccountId={wallet.accountId} />
        : <SignIn />
      }

      <hr />

      {!!messages.length && <Messages messages={messages} />}

    </main>
  )
}

export default App
