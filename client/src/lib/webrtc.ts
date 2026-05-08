export const stunServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const turnUrls = String(import.meta.env.VITE_TURN_URLS || "")
  .split(",")
  .map((url: string) => url.trim())
  .filter(Boolean);

const turnUsername = String(import.meta.env.VITE_TURN_USERNAME || "").trim();
const turnCredential = String(import.meta.env.VITE_TURN_CREDENTIAL || "").trim();
const hasCompleteTurnConfig =
  turnUrls.length > 0 && turnUsername.length > 0 && turnCredential.length > 0;

const turnServer: RTCIceServer | null = hasCompleteTurnConfig
  ? {
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    }
  : null;

export const peerConnectionConfig: RTCConfiguration = {
  iceServers: turnServer ? [...stunServers, turnServer] : stunServers,
};

export const stunOnlyPeerConnectionConfig: RTCConfiguration = {
  iceServers: stunServers,
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
