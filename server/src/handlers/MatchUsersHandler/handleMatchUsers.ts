import {
  addUserToWaitingQueue,
  getUserFromWaitingQueue,
  getWaitingUsersCount,
  removeUserFromWaitingQueue,
} from "../WaitingUsersQueueHandler/handleWaitingQueue";

const MatchedUser: Map<string, string> = new Map();

export const matchUser = (id: string) => {
  addUserToWaitingQueue(id);

  if (getWaitingUsersCount() <= 1) {
    return null;
  }

  const users = getUserFromWaitingQueue();

  if (!users) return;

  MatchedUser.set(users.user1, users.user2);
  MatchedUser.set(users.user2, users.user1);

  removeUserFromWaitingQueue(users.user1, users.user2);
  return users;
};

export const getMatch = (id: string) => {
  return MatchedUser.get(id);
};

export const removeUserFromMatch = (id: string) => {
  MatchedUser.delete(id);
};

export const printMatch = () => {
  console.log(MatchedUser);
};
