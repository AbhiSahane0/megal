import {
  addUserToWaitingQueue,
  getUserFromWaitingQueue,
  getWaitingUsersCount,
  removeUserFromWaitingQueue,
} from "../WaitingUsersQueueHandler/handleWaitingQueue";

const matchedUsers = new Map<string, string>();

export const matchUser = (id: string) => {
  addUserToWaitingQueue(id);

  if (getWaitingUsersCount() <= 1) {
    return null;
  }

  const users = getUserFromWaitingQueue();

  if (!users) return null;

  matchedUsers.set(users.user1, users.user2);
  matchedUsers.set(users.user2, users.user1);

  removeUserFromWaitingQueue(users.user1, users.user2);
  return users;
};

export const getMatch = (id: string) => {
  return matchedUsers.get(id);
};

export const removeUserFromMatch = (id: string) => {
  matchedUsers.delete(id);
};

export const printMatch = () => {
  console.log(matchedUsers);
};
