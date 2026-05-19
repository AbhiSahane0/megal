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
import {
  mediaConstraints,
  peerConnectionConfig,
  stunOnlyPeerConnectionConfig,
} from "./lib/webrtc";
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

const MIC_GAIN = 1.7;

const App = () => {
  const [liveUsersCount, setLiveUsersCount] = useState(0);
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);
  const [matchedUserUserName, setMatchedUserUserName] = useState("Stranger");
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [isStrangerTyping, setIsStrangerTyping] = useState(false);
  const [isChatStarted, setIsChatStarted] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [hasLocalMedia, setHasLocalMedia] = useState(false);
  const [hasRemoteMedia, setHasRemoteMedia] = useState(false);
  const [isRequestingMedia, setIsRequestingMedia] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const isSecureContext = window.isSecureContext;

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const rawLocalStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const matchedUserIdRef = useRef<string | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const mediaRequestRef = useRef<Promise<void> | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);
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
    rawLocalStreamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();
    localStreamRef.current = null;
    rawLocalStreamRef.current = null;
    audioContextRef.current = null;
    setHasLocalMedia(false);
    setIsRequestingMedia(false);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, []);

  const createProcessedMediaStream = useCallback((stream: MediaStream) => {
    const audioTrack = stream.getAudioTracks()[0];
    const videoTracks = stream.getVideoTracks();

    if (!audioTrack) return stream;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as Window &
            typeof globalThis & { webkitAudioContext?: typeof AudioContext }
        ).webkitAudioContext;
      if (!AudioContextClass) return stream;

      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(
        new MediaStream([audioTrack]),
      );
      const gain = audioContext.createGain();
      const compressor = audioContext.createDynamicsCompressor();
      const destination = audioContext.createMediaStreamDestination();

      gain.gain.value = MIC_GAIN;
      compressor.threshold.value = -28;
      compressor.knee.value = 22;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.2;

      source.connect(gain);
      gain.connect(compressor);
      compressor.connect(destination);

      audioContextRef.current = audioContext;

      const processedAudioTrack = destination.stream.getAudioTracks()[0];
      if (!processedAudioTrack) return stream;

      processedAudioTrack.enabled = audioTrack.enabled;

      return new MediaStream([...videoTracks, processedAudioTrack]);
    } catch (error) {
      console.warn("Audio boost pipeline unavailable; using raw microphone.", error);
      return stream;
    }
  }, []);

  const prepareLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return;
    if (mediaRequestRef.current) return mediaRequestRef.current;

    const requestMedia = async () => {
      setIsRequestingMedia(true);
      setMediaError(null);

      try {
        if (!window.isSecureContext) {
          throw new Error("Camera and microphone require a secure origin.");
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Media devices are not supported.");
        }

        const stream =
          await navigator.mediaDevices.getUserMedia(mediaConstraints);
        const hasAudio = stream.getAudioTracks().length > 0;
        const hasVideo = stream.getVideoTracks().length > 0;

        if (!hasAudio || !hasVideo) {
          stream.getTracks().forEach((track) => track.stop());
          throw new Error("Camera and microphone are required.");
        }

        rawLocalStreamRef.current = stream;
        localStreamRef.current = createProcessedMediaStream(stream);
        setHasLocalMedia(true);
        setIsMicEnabled(true);
        setIsCameraEnabled(true);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      } catch (error) {
        const message =
          error instanceof Error &&
          error.message.includes("secure origin")
            ? "Use HTTPS or localhost to enable camera and microphone."
            : "Allow camera and microphone to start.";

        setMediaError(message);
        setHasLocalMedia(false);
        toast(message, {
          type: "warning",
          position: "top-center",
        });
      } finally {
        setIsRequestingMedia(false);
        mediaRequestRef.current = null;
      }
    };

    mediaRequestRef.current = requestMedia();
    return mediaRequestRef.current;
  }, [createProcessedMediaStream]);

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

      let pc: RTCPeerConnection;

      try {
        pc = new RTCPeerConnection(peerConnectionConfig);
      } catch (error) {
        console.error("RTCPeerConnection config failed. Falling back to STUN.", {
          error,
          peerConnectionConfig,
        });
        pc = new RTCPeerConnection(stunOnlyPeerConnectionConfig);
      }

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
      } catch (error) {
        console.error("Could not start video call.", error);
        setCallStatus("failed");
        toast("Could not start video call.", {
          type: "error",
          position: "top-center",
        });
      }
    },
    [createPeerConnection],
  );

  const clearTypingTimeout = useCallback(() => {
    if (!typingTimeoutRef.current) return;
    window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;
  }, []);

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      const matchedUser = matchedUserIdRef.current;
      if (!matchedUser || isTypingRef.current === isTyping) return;

      isTypingRef.current = isTyping;
      socket.emit("typing", { to: matchedUser, isTyping });

      if (!isTyping) {
        clearTypingTimeout();
      }
    },
    [clearTypingTimeout],
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
      emitTyping(false);
      cleanupPeerConnection();
      matchedUserIdRef.current = id;
      setMatchedUserId(id);
      setMatchedUserUserName(matchedName || "Stranger");
      setChat([]);
      setIsStrangerTyping(false);
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
      setIsStrangerTyping(false);
      setChat((prev) => [...prev, createMessage(incomingMessage, "stranger")]);
    };

    const handleTyping = ({
      from,
      isTyping,
    }: {
      from: string;
      isTyping: boolean;
    }) => {
      if (from !== matchedUserIdRef.current) return;
      setIsStrangerTyping(isTyping);
    };

    const handleMatchDisconnect = () => {
      cleanupPeerConnection();
      setIsStrangerTyping(false);
      emitTyping(false);
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
      } catch (error) {
        console.error("Could not answer video call.", error);
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
      } catch (error) {
        console.error("Could not apply video answer.", error);
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
      } catch (error) {
        console.error("Could not add ICE candidate.", error);
        setCallStatus("failed");
      }
    };

    socket.on("liveUserCount", handleLiveUserCount);
    socket.on("match", handleMatch);
    socket.on("chat", handleChat);
    socket.on("typing", handleTyping);
    socket.on("MatchDisconnect", handleMatchDisconnect);
    socket.on("video-offer", handleVideoOffer);
    socket.on("video-answer", handleVideoAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("liveUserCount", handleLiveUserCount);
      socket.off("match", handleMatch);
      socket.off("chat", handleChat);
      socket.off("typing", handleTyping);
      socket.off("MatchDisconnect", handleMatchDisconnect);
      socket.off("video-offer", handleVideoOffer);
      socket.off("video-answer", handleVideoAnswer);
      socket.off("ice-candidate", handleIceCandidate);
    };
  }, [
    cleanupPeerConnection,
    createAndSendOffer,
    createPeerConnection,
    emitTyping,
    flushPendingIceCandidates,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, matchedUserId]);

  useEffect(() => {
    return () => {
      clearTypingTimeout();
      emitTyping(false);
      cleanupPeerConnection();
      stopLocalMedia();
    };
  }, [clearTypingTimeout, cleanupPeerConnection, emitTyping, stopLocalMedia]);

  const handleMessageSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const messageText = msg.trim();
    if (!matchedUserId || !messageText) return;

    emitTyping(false);
    setChat((prev) => [...prev, createMessage(messageText, "me")]);
    setMsg("");
    socket.emit("message", { message: messageText, to: matchedUserId });
  };

  const handleMessageChange = (value: string) => {
    setMsg(value);

    if (!matchedUserId) return;

    if (!value.trim()) {
      emitTyping(false);
      return;
    }

    emitTyping(true);
    clearTypingTimeout();
    typingTimeoutRef.current = window.setTimeout(() => {
      emitTyping(false);
    }, 1200);
  };

  const handleStartChat = async () => {
    if (!hasLocalMedia) {
      await prepareLocalMedia();
    }

    if (!localStreamRef.current) return;

    setIsChatStarted(true);
    setCallStatus("searching");
    socket.emit("join", userName.trim() || "Stranger");
  };

  const clearCurrentMatch = (nextStatus: CallStatus) => {
    cleanupPeerConnection();
    matchedUserIdRef.current = null;
    setMatchedUserId(null);
    setMatchedUserUserName("Stranger");
    setChat([]);
    setIsStrangerTyping(false);
    emitTyping(false);
    setMsg("");
    setCallStatus(nextStatus);
  };

  const handleFindMatch = async () => {
    if (!localStreamRef.current) {
      await prepareLocalMedia();
    }

    if (!localStreamRef.current) return;

    clearCurrentMatch("searching");
    socket.emit("join", userName.trim() || "Stranger");
  };

  const handleSkipMatch = () => {
    if (!matchedUserId) {
      void handleFindMatch();
      return;
    }

    socket.emit("skip");
    clearCurrentMatch("searching");
  };

  const handleHangUp = () => {
    if (matchedUserId) {
      socket.emit("leave-match");
    } else if (callStatus === "searching") {
      socket.emit("leave-queue");
    }

    clearCurrentMatch("idle");
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
    return (
      <StartChat
        hasLocalMedia={hasLocalMedia}
        isRequestingMedia={isRequestingMedia}
        mediaError={mediaError}
        isCameraEnabled={isCameraEnabled}
        isMicEnabled={isMicEnabled}
        isSecureContext={isSecureContext}
        onToggleCamera={toggleCamera}
        onToggleMic={toggleMic}
        onRequestMedia={prepareLocalMedia}
        onStart={() => void handleStartChat()}
        previewRef={localVideoRef}
      />
    );
  }

  return (
    <main className="h-[100svh] overflow-hidden bg-[#f5f1e8] text-zinc-950">
      <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col px-3 py-3 sm:px-6 sm:py-4">
        <header className="shrink-0 py-1">
          <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt=""
              className="h-10 w-10 rounded-lg"
            />
            <div>
              <p className="font-semibold leading-tight">Megal</p>
              <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
                <StatusDot isLive={Boolean(matchedUserId)} />
                {matchedUserId
                  ? matchedUserUserName
                  : callStatus === "idle"
                    ? "Idle"
                    : "Searching"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <Users className="h-4 w-4" />
            <span>{liveUsersCount} online</span>
          </div>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(176px,32svh)] gap-3 py-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-none lg:gap-4 lg:py-4">
          <div className="relative min-h-0 overflow-hidden rounded-lg bg-zinc-950 shadow-sm">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`h-full w-full object-cover transition ${
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
                    {callStatus === "idle"
                      ? "Ready when you are"
                      : matchedUserId
                        ? "Connecting video"
                        : "Finding a stranger"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {callStatus === "idle"
                      ? "Start matching when you want to meet someone new."
                      : mediaError || "Keep this tab open while Megal pairs you."}
                  </p>
                  {callStatus === "idle" && (
                    <button
                      type="button"
                      className="mt-5 min-h-11 rounded-lg bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                      onClick={() => void handleFindMatch()}
                    >
                      Find Match
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="absolute right-3 top-3 overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-lg sm:right-4 sm:top-4">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`h-24 w-18 object-cover sm:h-36 sm:w-28 ${
                  hasLocalMedia && isCameraEnabled ? "opacity-100" : "opacity-0"
                }`}
              />
              {(!hasLocalMedia || !isCameraEnabled) && (
                <div className="absolute inset-0 grid place-items-center text-zinc-400">
                  <VideoOff className="h-5 w-5" />
                </div>
              )}
            </div>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-zinc-900/85 p-2 shadow-lg backdrop-blur sm:bottom-4">
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
                className="grid h-11 min-w-11 place-items-center rounded-full bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                onClick={handleSkipMatch}
                disabled={!matchedUserId && callStatus !== "idle"}
                aria-label={matchedUserId ? "Skip stranger" : "Find match"}
              >
                {matchedUserId ? "Skip" : "Find"}
              </button>

              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-full bg-rose-600 text-white transition hover:bg-rose-500"
                onClick={handleHangUp}
                aria-label="Hang up"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>

            <div className="absolute left-4 top-4 rounded-full bg-zinc-900/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-zinc-300 backdrop-blur">
              {callStatus}
            </div>
          </div>

          <aside className="flex min-h-0 flex-col rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-zinc-200 px-4 py-3">
              <p className="text-sm font-semibold">Stranger chat</p>
              <p className="text-xs text-zinc-500">
                {isStrangerTyping
                  ? "...Typing"
                  : matchedUserId
                  ? "Connected"
                  : callStatus === "idle"
                    ? "Idle"
                    : "Waiting"}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {chat.length === 0 ? (
                <div className="grid h-full min-h-52 place-items-center text-center">
                  <p className="max-w-48 text-sm leading-6 text-zinc-400">
                    {matchedUserId
                      ? "No messages yet."
                      : callStatus === "idle"
                        ? "Tap Find Match when you are ready."
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
              className="shrink-0 flex items-center gap-2 border-t border-zinc-200 p-3"
              onSubmit={handleMessageSubmit}
            >
              <input
                type="text"
                placeholder={matchedUserId ? "Message" : "Waiting"}
                className="min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-zinc-100"
                value={msg}
                onChange={(event) => handleMessageChange(event.target.value)}
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
