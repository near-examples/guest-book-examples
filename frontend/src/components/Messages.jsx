export default function Messages({ messages }) {
  return (
    <div className="container">
      <h2 className="my-4">Messages</h2>
      {messages.map((message, i) => (
        <div
          key={i}
          className={`card mb-3 ${message.premium ? "border-primary" : ""}`}
        >
          <div className="card-body">
            <h5 className="card-title">
              <strong>{message.sender}</strong>
              {message.premium && (
                <span className="badge bg-primary ms-2">Premium</span>
              )}
            </h5>
            <p className="card-text">{message.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
