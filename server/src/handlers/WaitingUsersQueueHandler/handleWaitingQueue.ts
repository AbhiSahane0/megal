let waitingUsersQueue: string[] = [];

export const getWaitingUsersCount = () => {
  return waitingUsersQueue.length;
};

export const addUserToWaitingQueue = (id: string) => {
  if (waitingUsersQueue.includes(id)) return;
  waitingUsersQueue.push(id);
};

export const removeUserFromWaitingQueue = (user1: string, user2?: string) => {
  waitingUsersQueue = waitingUsersQueue.filter(
    (item) => item != user1 && item != user2,
  );
};

export const getUserFromWaitingQueue = () => {
  if (waitingUsersQueue.length < 2) return null;
  return { user1: waitingUsersQueue[0], user2: waitingUsersQueue[1] };
};

export const printWaitingUsers = () => {
  console.log(waitingUsersQueue);
};
