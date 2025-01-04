import { useEffect, useState } from "react";

function Message({ sender, premium, text }) {

  const [show, setShow] = useState('');

  useEffect(() => {
    setTimeout(() => setShow('show'), 100);
  }, []);

  return (
    <div className={`card ${show} mb-3 ${premium ? "border-primary" : ""}`}>
      <div className="card-body">
        <h5 className="card-title">
          <strong>{sender}</strong>
          {premium && (
            <span className="badge bg-primary ms-2">Premium</span>
          )}
        </h5>
        <p className="card-text">{text}</p>
      </div>
    </div>
  );
}

export default function Messages({ messages }) {
  return (
    <div className="container fade-animation">
      <h2 className="my-4">Messages</h2>
      {messages.map((message, i) => <Message key={`${message.sender}-${message.text}`} {...message} />)}
    </div>
  );
}
