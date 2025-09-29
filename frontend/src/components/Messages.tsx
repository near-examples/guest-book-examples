import { useEffect, useState } from "react";

// Simple message props type
type MessageProps = {
  sender: string | null;
  text: string;
  premium?: boolean;
};

function Message({ sender, premium = false, text }: MessageProps) {
  const [show, setShow] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setShow('show'), 100);
    return () => clearTimeout(timeout); // cleanup
  }, []);

  return (
    <div className={`card ${show} mb-3 ${premium ? "border-primary" : ""}`}>
      <div className="card-body">
        <h5 className="card-title">
          <strong>{sender}</strong>
          {premium && <span className="badge bg-primary ms-2">Premium</span>}
        </h5>
        <p className="card-text">{text}</p>
      </div>
    </div>
  );
}

// Props for Messages component
type MessagesProps = {
  messages: MessageProps[];
};

export default function Messages({ messages }: MessagesProps) {
  return (
    <div className="container fade-animation">
      <h2 className="my-4">Messages</h2>
      {messages.map((message) => (
        <Message
          key={`${message.sender}-${message.text}`}
          {...message}
        />
      ))}
    </div>
  );
}
