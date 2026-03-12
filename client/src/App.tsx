import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import StartChat from "./components/StartChat";

let url = "https://megal-pvcj.onrender.com";

if (import.meta.env.DEV) {
  url = `http://${window.location.hostname}:3000`;
}

const socket = io(url);
const LiveStatus = ({ isLive }: { isLive: boolean }) => {
  return (
    <div
      style={{
        display: "inline-block",
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        backgroundColor: isLive ? "green" : "gray",
        marginLeft: "5px",
        border: "1px solid #ddd",
      }}
    />
  );
};

type chatType = { msg: string; from: "me" | "stranger" };

const App = () => {
  const [liveUsersCount, setLiveUsersCount] = useState<number>(0);
  // State for current users id
  // const [myId, setMyId] = useState<string>("");
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);

  const [msg, setMsg] = useState<string>("");
  const [chat, setChat] = useState<chatType[]>([]);
  const [isChatStarted, setIsChatStarted] = useState<boolean>(false);

  console.log(matchedUserId);

  useEffect(() => {
    if (isChatStarted) return;

    socket.on("liveUserCount", (count) => setLiveUsersCount(count));

    // current users ID if required
    // socket.on("me", (id) => setMyId(id));

    socket.on("match", (id) => {
      setMatchedUserId(id);
      setChat([]);
      if (!id) return;
      toast("You got new match", { type: "success", position: "top-center" });
    });
    socket.on("chat", (msg) =>
      setChat((prev) => [...prev, { msg: msg, from: "stranger" }]),
    );

    socket.on("MatchDisconnect", () => {
      toast("User left 🥲. Finding new match.", {
        type: "error",
        position: "top-center",
      });
    });
  }, [isChatStarted]);

  const handleMessageSubmit = () => {
    if (msg === "") return;
    const message = {
      message: msg,
      to: matchedUserId,
    };
    setChat((prev) => [...prev, { msg: msg, from: "me" }]);

    setMsg("");
    socket.emit("message", message);
  };

  const handleKeyDown = (event: {
    key: string;
    preventDefault: () => void;
  }) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleMessageSubmit();
    }
  };

  const handleStartChat = () => {
    socket.emit("findPair");
    setIsChatStarted(true);
  };

  return (
    <>
      {isChatStarted ? (
        <div className="min-h-screen w-full bg-slate-50 text-slate-900">
          <div className="mx-auto w-full max-w-3xl px-4 py-10">
            {/* Header */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Live users */}
                <div className="flex items-center gap-4">
                  <LiveStatus isLive={true} />
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-sm text-slate-500">Live users</p>
                    <p className="text-2xl font-semibold tracking-tight text-slate-900">
                      {liveUsersCount}
                    </p>
                  </div>
                </div>

                {/* Matched user */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-500">Matched user</p>
                  <p className="max-w-65 truncate font-mono text-sm text-slate-800">
                    {matchedUserId ? matchedUserId : "Finding someone..."}
                  </p>
                </div>
              </div>
            </div>

            {/* Chat card */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Chat</h2>

                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Secure
                </span>
              </div>

              {/* Messages */}
              <div className="h-[35vh] sm:h-[50vh] w-full overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
                {chat.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex ${item.from === "me" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        item.from === "me"
                          ? "bg-sky-600 text-white"
                          : "bg-white border border-slate-200 text-slate-800"
                      }`}
                    >
                      {item.msg}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!matchedUserId}
                />

                <button
                  className="w-full rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-sky-500 active:scale-[0.98] sm:w-auto cursor-pointer disabled:cursor-not-allowed"
                  onClick={handleMessageSubmit}
                  disabled={!matchedUserId || msg === ""}
                >
                  Send
                </button>
              </div>
            </div>

            {/* Footer */}
            <p className="mt-6 text-center text-xs text-slate-400">
              Positive conversations only ✨
            </p>
          </div>
        </div>
      ) : (
        <StartChat onStart={handleStartChat} />
      )}
    </>
  );
};

export default App;
