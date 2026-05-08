export type ChatMessage = {
  id: string;
  msg: string;
  from: "me" | "stranger";
};
