import { Server } from "socket.io";

import {
  addLiveUser,
  getLiveUsersCount,
  removeUser,
} from "../handlers/UserConnectHandler/handleUserConnect";
import {
  getMatch,
  matchUser,
  removeUserFromMatch,
} from "../handlers/MatchUsersHandler/handleMatchUsers";
import { removeUserFromWaitingQueue } from "../handlers/WaitingUsersQueueHandler/handleWaitingQueue";
import {
  getMappedUserName,
  removeUsernameMapping,
  setUsernameMapping,
} from "../handlers/userNameMappingHandler/handleUsernameMapping";

type SignalDescription = {
  type: "offer" | "answer";
  sdp?: string;
};

type IceCandidate = {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

type ClientToServerEvents = {
  join: (userName: string) => void;
  message: (data: { message: string; to: string }) => void;
  typing: (data: { to: string; isTyping: boolean }) => void;
  stop: () => void;
  skip: () => void;
  "leave-match": () => void;
  "leave-queue": () => void;
  "video-offer": (data: { to: string; offer: SignalDescription }) => void;
  "video-answer": (data: { to: string; answer: SignalDescription }) => void;
  "ice-candidate": (data: { to: string; candidate: IceCandidate }) => void;
};

type ServerToClientEvents = {
  liveUserCount: (count: number) => void;
  me: (id: string) => void;
  match: (id: string | null, userName?: string, shouldCreateOffer?: boolean) => void;
  chat: (msg: string) => void;
  typing: (data: { from: string; isTyping: boolean }) => void;
  MatchDisconnect: () => void;
  "video-offer": (data: { from: string; offer: SignalDescription }) => void;
  "video-answer": (data: { from: string; answer: SignalDescription }) => void;
  "ice-candidate": (data: { from: string; candidate: IceCandidate }) => void;
};

export const CreateSocketConnection = (
  io: Server<ClientToServerEvents, ServerToClientEvents>,
) => {
  const emitLiveUserCount = () => {
    io.emit("liveUserCount", getLiveUsersCount());
  };

  const emitMatch = (user1: string, user2: string) => {
    io.to(user1).emit("match", user2, getMappedUserName({ id: user2 }), true);
    io.to(user2).emit("match", user1, getMappedUserName({ id: user1 }), false);
  };

  const matchWaitingUser = (id: string, blockedId?: string) => {
    const match = matchUser(id, blockedId);
    if (!match) return;

    emitMatch(match.user1, match.user2);
  };

  const clearMatch = (socketId: string) => {
    const matchedUserId = getMatch(socketId);
    removeUserFromMatch(socketId);

    if (matchedUserId) {
      removeUserFromMatch(matchedUserId);
    }

    return matchedUserId;
  };

  const leaveCurrentMatch = ({
    socketId,
    requeueSelf,
    requeueMatchedUser,
    notifyMatchedUser,
  }: {
    socketId: string;
    requeueSelf: boolean;
    requeueMatchedUser: boolean;
    notifyMatchedUser: boolean;
  }) => {
    removeUserFromWaitingQueue(socketId);

    const matchedUserId = clearMatch(socketId);
    if (!matchedUserId) return;

    if (notifyMatchedUser) {
      io.to(matchedUserId).emit("match", null);
      io.to(matchedUserId).emit("MatchDisconnect");
    }

    if (requeueSelf) {
      matchWaitingUser(socketId, matchedUserId);
    }

    if (requeueMatchedUser) {
      matchWaitingUser(matchedUserId, socketId);
    }
  };

  const endUserSession = (socketId: string) => {
    removeUser(socketId);
    removeUserFromWaitingQueue(socketId);
    removeUsernameMapping({ id: socketId });

    const matchedUserId = clearMatch(socketId);
    emitLiveUserCount();

    if (!matchedUserId) return;

    io.to(matchedUserId).emit("match", null);
    io.to(matchedUserId).emit("MatchDisconnect");
    matchWaitingUser(matchedUserId);
  };

  io.on("connection", (socket) => {
    socket.on("join", (userName) => {
      const currentMatch = getMatch(socket.id);
      if (currentMatch) {
        emitMatch(socket.id, currentMatch);
        return;
      }

      removeUserFromWaitingQueue(socket.id);
      addLiveUser(socket.id);
      socket.emit("me", socket.id);

      emitLiveUserCount();

      setUsernameMapping({ id: socket.id, userName: userName || "Stranger" });

      matchWaitingUser(socket.id);
    });

    socket.on("message", (data) => {
      io.to(data.to).emit("chat", data.message);
    });

    socket.on("typing", ({ to, isTyping }) => {
      io.to(to).emit("typing", { from: socket.id, isTyping });
    });

    socket.on("video-offer", ({ to, offer }) => {
      io.to(to).emit("video-offer", { from: socket.id, offer });
    });

    socket.on("video-answer", ({ to, answer }) => {
      io.to(to).emit("video-answer", { from: socket.id, answer });
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
      io.to(to).emit("ice-candidate", { from: socket.id, candidate });
    });

    // On user disconnect
    socket.on("disconnect", () => {
      endUserSession(socket.id);
    });

    socket.on("stop", () => {
      endUserSession(socket.id);
    });

    socket.on("skip", () => {
      leaveCurrentMatch({
        socketId: socket.id,
        requeueSelf: true,
        requeueMatchedUser: true,
        notifyMatchedUser: true,
      });
    });

    socket.on("leave-match", () => {
      leaveCurrentMatch({
        socketId: socket.id,
        requeueSelf: false,
        requeueMatchedUser: true,
        notifyMatchedUser: true,
      });
    });

    socket.on("leave-queue", () => {
      removeUserFromWaitingQueue(socket.id);
    });

    // emit an event of live users updated count when new user connects
  });
};
