const liveUsers = new Set<string>();

export const addLiveUser = (id: string) => {
  liveUsers.add(id);
};

export const removeUser = (id: string) => {
  liveUsers.delete(id);
};

export const getLiveUsersCount = () => {
  return liveUsers.size;
};
