const stunServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const turnUrls = String(import.meta.env.VITE_TURN_URLS || "")
  .split(",")
  .map((url: string) => url.trim())
  .filter(Boolean);

const turnServer: RTCIceServer | null = turnUrls?.length
  ? {
      urls: turnUrls,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    }
  : null;

export const peerConnectionConfig: RTCConfiguration = {
  iceServers: turnServer ? [...stunServers, turnServer] : stunServers,
};

export const mediaConstraints: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "user",
  },
};
