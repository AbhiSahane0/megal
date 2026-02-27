let Waiting_Users_Queue: string[] = [];

export const getWaitingUsersCount = () => {
  return Waiting_Users_Queue.length;
};

export const addUserToWaitingQueue = (id: string) => {
  Waiting_Users_Queue.push(id);
};

export const removeUserFromWaitingQueue = (user1: string, user2?: string) => {
  Waiting_Users_Queue = Waiting_Users_Queue.filter(
    (item) => item != user1 && item != user2,
  );
};

export const getUserFromWaitingQueue = () => {
  return { user1: Waiting_Users_Queue[0], user2: Waiting_Users_Queue[1] };
};

export const printWaitingUsers = () => {
  console.log(Waiting_Users_Queue);
};
