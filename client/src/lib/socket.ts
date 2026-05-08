import { io, type Socket } from "socket.io-client";

type ServerToClientEvents = {
  liveUserCount: (count: number) => void;
  me: (id: string) => void;
  match: (id: string | null, userName?: string, shouldCreateOffer?: boolean) => void;
  chat: (msg: string) => void;
  MatchDisconnect: () => void;
  "video-offer": (data: { from: string; offer: RTCSessionDescriptionInit }) => void;
  "video-answer": (data: { from: string; answer: RTCSessionDescriptionInit }) => void;
  "ice-candidate": (data: { from: string; candidate: RTCIceCandidateInit }) => void;
};

type ClientToServerEvents = {
  join: (userName: string) => void;
  message: (data: { message: string; to: string }) => void;
  stop: () => void;
  "video-offer": (data: { to: string; offer: RTCSessionDescriptionInit }) => void;
  "video-answer": (data: { to: string; answer: RTCSessionDescriptionInit }) => void;
  "ice-candidate": (data: { to: string; candidate: RTCIceCandidateInit }) => void;
};

const getSocketUrl = () => {
  if (import.meta.env.DEV) {
    return `http://${window.location.hostname}:3000`;
  }

  return "https://megal-pvcj.onrender.com";
};

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  io(getSocketUrl());
