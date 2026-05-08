import "dotenv/config";
import app from "./app";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { CreateSocketConnection } from "./socket.io/CreateSocketConnection";

const port = process.env.PORT || 3000;
const configuredOrigins = process.env.CLIENT_ORIGIN?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigin =
  process.env.NODE_ENV === "development" ? "*" : configuredOrigins;

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
