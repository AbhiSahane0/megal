import "dotenv/config";
import app from "./app";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { CreateSocketConnection } from "./socket.io/CreateSocketConnection";

const port = process.env.PORT || 3000;

const normalizeOrigin = (origin: string) => {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.trim().replace(/\/$/, "");
  }
};

const configuredOrigins = new Set(
  (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean),
);

const allowedOrigin =
  process.env.NODE_ENV === "development"
    ? "*"
    : (
        origin: string | undefined,
        callback: (error: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        const normalizedOrigin = normalizeOrigin(origin);
        const isAllowed = configuredOrigins.has(normalizedOrigin);

        if (!isAllowed) {
          callback(new Error(`CORS blocked origin: ${normalizedOrigin}`));
          return;
        }

        callback(null, true);
      };

// creating new server
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  },
});

CreateSocketConnection(io);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export { io, server };
