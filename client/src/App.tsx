import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { toast } from "react-toastify";
import StartChat from "./components/StartChat";
import { socket } from "./lib/socket";
import { mediaConstraints, peerConnectionConfig } from "./lib/webrtc";
import useUserName from "./store/userName/useUserName";
import type { ChatMessage } from "./types/chat";

type CallStatus = "idle" | "searching" | "connecting" | "connected" | "failed";

const createMessage = (
  msg: string,
  from: ChatMessage["from"],
): ChatMessage => ({
  id: `${from}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  msg,
  from,
});

const StatusDot = ({ isLive }: { isLive: boolean }) => (
  <span
    className={`h-2.5 w-2.5 rounded-full ${
      isLive ? "bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]" : "bg-zinc-500"
    }`}
  />
);

const App = () => {
  const [liveUsersCount, setLiveUsersCount] = useState(0);
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);
  const [matchedUserUserName, setMatchedUserUserName] = useState("Stranger");
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [isChatStarted, setIsChatStarted] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [hasLocalMedia, setHasLocalMedia] = useState(false);
  const [hasRemoteMedia, setHasRemoteMedia] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const matchedUserIdRef = useRef<string | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const userName = useUserName((state) => state.userName);

  const canSend = useMemo(
    () => Boolean(matchedUserId && msg.trim()),
    [matchedUserId, msg],
  );

  const cleanupPeerConnection = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    remoteStreamRef.current = null;
    pendingIceCandidatesRef.current = [];
    setHasRemoteMedia(false);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setHasLocalMedia(false);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, []);

  const prepareLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return;

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(mediaConstraints);
      localStreamRef.current = stream;
      setHasLocalMedia(true);
      setMediaError(null);
      setIsMicEnabled(true);
      setIsCameraEnabled(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch {
      setMediaError("Camera or microphone is unavailable.");
      setHasLocalMedia(false);
      toast("Camera or microphone is unavailable.", {
        type: "warning",
        position: "top-center",
      });
    }
  }, []);

  const flushPendingIceCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc?.remoteDescription) return;

    const candidates = pendingIceCandidatesRef.current;
    pendingIceCandidatesRef.current = [];

    await Promise.all(
      candidates.map((candidate) =>
        pc.addIceCandidate(new RTCIceCandidate(candidate)),
      ),
    );
  }, []);

  const createPeerConnection = useCallback(
    (remoteUserId: string) => {
      cleanupPeerConnection();
      setCallStatus("connecting");

      const pc = new RTCPeerConnection(peerConnectionConfig);
      const remoteStream = new MediaStream();
      const localStream = localStreamRef.current;

      peerConnectionRef.current = pc;
      remoteStreamRef.current = remoteStream;

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      if (!localStream?.getVideoTracks().length) {
        pc.addTransceiver("video", { direction: "recvonly" });
      }

      if (!localStream?.getAudioTracks().length) {
        pc.addTransceiver("audio", { direction: "recvonly" });
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        socket.emit("ice-candidate", {
          to: remoteUserId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;

        if (stream) {
          remoteStreamRef.current = stream;
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        } else {
          remoteStream.addTrack(event.track);
        }

        setHasRemoteMedia(true);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setCallStatus("connected");
        }

        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          setCallStatus("failed");
        }
      };

      return pc;
    },
    [cleanupPeerConnection],
  );

  const createAndSendOffer = useCallback(
    async (remoteUserId: string) => {
      try {
        const pc = createPeerConnection(remoteUserId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("video-offer", { to: remoteUserId, offer });
      } catch {
        setCallStatus("failed");
        toast("Could not start video call.", {
          type: "error",
          position: "top-center",
        });
      }
    },
    [createPeerConnection],
  );

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [hasLocalMedia, isChatStarted]);

  useEffect(() => {
    const handleLiveUserCount = (count: number) => setLiveUsersCount(count);

    const handleMatch = (
      id: string | null,
      matchedName?: string,
      shouldCreateOffer = false,
    ) => {
      cleanupPeerConnection();
      matchedUserIdRef.current = id;
      setMatchedUserId(id);
      setMatchedUserUserName(matchedName || "Stranger");
      setChat([]);
      setCallStatus(id ? "connecting" : "searching");

      if (!id) return;

      toast("Connected to a stranger", {
        type: "success",
        position: "top-center",
      });

      if (shouldCreateOffer) {
        void createAndSendOffer(id);
      }
    };

    const handleChat = (incomingMessage: string) => {
      setChat((prev) => [...prev, createMessage(incomingMessage, "stranger")]);
    };

    const handleMatchDisconnect = () => {
      cleanupPeerConnection();
      setCallStatus("searching");
      toast("Stranger left. Finding a new match.", {
        type: "error",
        position: "top-center",
      });
    };

    const handleVideoOffer = async ({
      from,
      offer,
    }: {
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (from !== matchedUserIdRef.current) return;

      try {
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(offer);
        await flushPendingIceCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("video-answer", { to: from, answer });
      } catch {
        setCallStatus("failed");
      }
    };

    const handleVideoAnswer = async ({
      from,
      answer,
    }: {
      from: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      const pc = peerConnectionRef.current;
      if (from !== matchedUserIdRef.current || !pc) return;

      try {
        if (pc.signalingState !== "stable") {
          await pc.setRemoteDescription(answer);
          await flushPendingIceCandidates();
        }
      } catch {
        setCallStatus("failed");
      }
    };

    const handleIceCandidate = async ({
      from,
      candidate,
    }: {
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peerConnectionRef.current;
      if (from !== matchedUserIdRef.current) return;

      if (!pc?.remoteDescription) {
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        setCallStatus("failed");
      }
    };

    socket.on("liveUserCount", handleLiveUserCount);
    socket.on("match", handleMatch);
    socket.on("chat", handleChat);
    socket.on("MatchDisconnect", handleMatchDisconnect);
    socket.on("video-offer", handleVideoOffer);
    socket.on("video-answer", handleVideoAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("liveUserCount", handleLiveUserCount);
      socket.off("match", handleMatch);
      socket.off("chat", handleChat);
      socket.off("MatchDisconnect", handleMatchDisconnect);
      socket.off("video-offer", handleVideoOffer);
      socket.off("video-answer", handleVideoAnswer);
      socket.off("ice-candidate", handleIceCandidate);
    };
  }, [
    cleanupPeerConnection,
    createAndSendOffer,
    createPeerConnection,
    flushPendingIceCandidates,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, matchedUserId]);

  useEffect(() => {
    return () => {
      cleanupPeerConnection();
      stopLocalMedia();
    };
  }, [cleanupPeerConnection, stopLocalMedia]);

  const handleMessageSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const messageText = msg.trim();
    if (!matchedUserId || !messageText) return;

    setChat((prev) => [...prev, createMessage(messageText, "me")]);
    setMsg("");
    socket.emit("message", { message: messageText, to: matchedUserId });
  };

  const handleStartChat = async () => {
    setIsChatStarted(true);
    setCallStatus("searching");
    await prepareLocalMedia();
    socket.emit("join", userName.trim() || "Stranger");
  };

  const handleChatStop = () => {
    socket.emit("stop");
    cleanupPeerConnection();
    stopLocalMedia();
    matchedUserIdRef.current = null;
    setMatchedUserId(null);
    setMatchedUserUserName("Stranger");
    setChat([]);
    setMsg("");
    setMediaError(null);
    setCallStatus("idle");
    setIsChatStarted(false);
  };

  const toggleMic = () => {
    const nextValue = !isMicEnabled;
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((track) => {
        track.enabled = nextValue;
      });
    setIsMicEnabled(nextValue);
  };

  const toggleCamera = () => {
    const nextValue = !isCameraEnabled;
    localStreamRef.current
      ?.getVideoTracks()
      .forEach((track) => {
        track.enabled = nextValue;
      });
    setIsCameraEnabled(nextValue);
  };

  if (!isChatStarted) {
    return <StartChat onStart={() => void handleStartChat()} />;
  }

  return (
    <main className="min-h-screen bg-[#f5f1e8] text-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6">
        <header className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-zinc-950 text-base font-semibold text-white">
              M
            </div>
            <div>
              <p className="font-semibold leading-tight">Megal</p>
              <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
                <StatusDot isLive={Boolean(matchedUserId)} />
                {matchedUserId ? matchedUserUserName : "Searching"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <Users className="h-4 w-4" />
            <span>{liveUsersCount} online</span>
          </div>
        </header>

        <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative min-h-[68vh] overflow-hidden rounded-lg bg-zinc-950 shadow-sm">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`h-full min-h-[68vh] w-full object-cover transition ${
                hasRemoteMedia ? "opacity-100" : "opacity-0"
              }`}
            />

            {!hasRemoteMedia && (
              <div className="absolute inset-0 grid place-items-center px-6 text-center text-white">
                <div>
                  <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-white/10">
                    <Video className="h-7 w-7" />
                  </div>
                  <p className="text-lg font-semibold">
                    {matchedUserId ? "Connecting video" : "Finding a stranger"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {mediaError || "Keep this tab open while Megal pairs you."}
                  </p>
                </div>
              </div>
            )}

            <div className="absolute right-3 top-3 overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-lg sm:right-4 sm:top-4">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`h-28 w-20 object-cover sm:h-36 sm:w-28 ${
                  hasLocalMedia && isCameraEnabled ? "opacity-100" : "opacity-0"
                }`}
              />
              {(!hasLocalMedia || !isCameraEnabled) && (
                <div className="absolute inset-0 grid place-items-center text-zinc-400">
                  <VideoOff className="h-5 w-5" />
                </div>
              )}
            </div>

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-zinc-900/85 p-2 shadow-lg backdrop-blur">
              <button
                type="button"
                className={`grid h-11 w-11 place-items-center rounded-full transition ${
                  isMicEnabled
                    ? "bg-white text-zinc-950 hover:bg-zinc-200"
                    : "bg-amber-300 text-zinc-950 hover:bg-amber-200"
                } disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400`}
                onClick={toggleMic}
                disabled={!hasLocalMedia}
                aria-label={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
              >
                {isMicEnabled ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )}
              </button>

              <button
                type="button"
                className={`grid h-11 w-11 place-items-center rounded-full transition ${
                  isCameraEnabled
                    ? "bg-white text-zinc-950 hover:bg-zinc-200"
                    : "bg-amber-300 text-zinc-950 hover:bg-amber-200"
                } disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400`}
                onClick={toggleCamera}
                disabled={!hasLocalMedia}
                aria-label={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
              >
                {isCameraEnabled ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </button>

              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-full bg-rose-600 text-white transition hover:bg-rose-500"
                onClick={handleChatStop}
                aria-label="End chat"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>

            <div className="absolute left-4 top-4 rounded-full bg-zinc-900/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-zinc-300 backdrop-blur">
              {callStatus}
            </div>
          </div>

          <aside className="flex min-h-[48vh] flex-col rounded-lg border border-zinc-200 bg-white shadow-sm lg:min-h-0">
            <div className="border-b border-zinc-200 px-4 py-3">
              <p className="text-sm font-semibold">Stranger chat</p>
              <p className="text-xs text-zinc-500">
                {matchedUserId ? "Connected" : "Waiting"}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {chat.length === 0 ? (
                <div className="grid h-full min-h-52 place-items-center text-center">
                  <p className="max-w-48 text-sm leading-6 text-zinc-400">
                    {matchedUserId
                      ? "No messages yet."
                      : "Messages appear when a stranger joins."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chat.map((item) => (
                    <div
                      key={item.id}
                      className={`flex ${item.from === "me" ? "justify-end" : "justify-start"}`}
                    >
                      <p
                        className={`max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6 ${
                          item.from === "me"
                            ? "bg-zinc-950 text-white"
                            : "bg-zinc-100 text-zinc-800"
                        }`}
                      >
                        {item.msg}
                      </p>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form
              className="flex items-center gap-2 border-t border-zinc-200 p-3"
              onSubmit={handleMessageSubmit}
            >
              <input
                type="text"
                placeholder={matchedUserId ? "Message" : "Waiting"}
                className="min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-zinc-100"
                value={msg}
                onChange={(event) => setMsg(event.target.value)}
                disabled={!matchedUserId}
              />

              <button
                type="submit"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal-600 text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                disabled={!canSend}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </aside>
        </section>
      </div>
    </main>
  );
};

export default App;
