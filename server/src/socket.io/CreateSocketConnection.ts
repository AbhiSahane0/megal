import { Server, DefaultEventsMap } from "socket.io";

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
  setUsernameMapping,
} from "../handlers/userNameMappingHandler/handleUsernameMapping";

export const CreateSocketConnection = (
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
) => {
  io.on("connection", (socket) => {
    socket.on("join", (userName) => {
      addLiveUser(socket.id);
      socket.emit("me", socket.id);

      io.emit("liveUserCount", getLiveUsersCount());

      setUsernameMapping({ id: socket.id, userName });

      const match = matchUser(socket.id);

      if (match) {
        const { user1, user2 } = match;

        io.to(user2).emit("match", user1, getMappedUserName({ id: user1 }));
        io.to(user1).emit("match", user2, getMappedUserName({ id: user2 }));
      }

      socket.on("message", (data) => {
        io.to(data.to).emit("chat", data.message);
      });
    });

    // On user disconnect
    socket.on("disconnect", () => {
      removeUser(socket.id);
      removeUserFromWaitingQueue(socket.id);
      const disconnectedUserId = socket.id;
      const matchUserId = getMatch(socket.id);
      io.to(matchUserId!).emit("match", null);
      io.to(matchUserId!).emit("MatchDisconnect");

      io.emit("liveUserCount", getLiveUsersCount());
      if (!matchUserId) return;

      removeUserFromMatch(disconnectedUserId);
      removeUserFromMatch(matchUserId);

      const match = matchUser(matchUserId);
      io.to(matchUserId).emit("match", null);

      if (!match) return;

      const { user1, user2 } = match;
      io.to(user1).emit("match", user2, getMappedUserName({ id: user2 }));
      io.to(user2).emit("match", user1, getMappedUserName({ id: user1 }));
    });

    socket.on("stop", () => {
      removeUser(socket.id);
      removeUserFromWaitingQueue(socket.id);
      const disconnectedUserId = socket.id;
      const matchUserId = getMatch(socket.id);
      io.to(matchUserId!).emit("match", null);
      io.to(matchUserId!).emit("MatchDisconnect");

      io.emit("liveUserCount", getLiveUsersCount());
      if (!matchUserId) return;

      removeUserFromMatch(disconnectedUserId);
      removeUserFromMatch(matchUserId);

      const match = matchUser(matchUserId);
      io.to(matchUserId).emit("match", null);

      if (!match) return;

      const { user1, user2 } = match;
      io.to(user1).emit("match", user2, getMappedUserName({ id: user2 }));
      io.to(user2).emit("match", user1, getMappedUserName({ id: user1 }));
    });

    // emit an event of live users updated count when new user connects
  });
};
