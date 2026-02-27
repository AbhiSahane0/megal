let TOTAL_LIVE_USERS: string[] = [];

export const addLiveUser = (id: string) => {
  TOTAL_LIVE_USERS.push(id);
};

export const removeUser = (id: string) => {
  TOTAL_LIVE_USERS = TOTAL_LIVE_USERS.filter((item) => item !== id);
};

export const getLiveUsersCount = () => {
  return TOTAL_LIVE_USERS.length;
};
