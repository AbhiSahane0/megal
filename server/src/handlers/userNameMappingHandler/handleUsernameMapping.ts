const userNameMapping: Map<string, string> = new Map();

export const setUsernameMapping = ({
  id,
  userName,
}: {
  id: string;
  userName: string;
}) => {
  userNameMapping.set(id, userName);
};

export const getMappedUserName = ({ id }: { id: string }) => {
  return userNameMapping.get(id);
};

export const removeUsernameMapping = ({ id }: { id: string }) => {
  userNameMapping.delete(id);
};
