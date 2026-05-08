import app from "./app";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { CreateSocketConnection } from "./socket.io/CreateSocketConnection";

const port = process.env.PORT || 3000;
const allowedOrigin =
  process.env.NODE_ENV === "development"
    ? "*"
    : process.env.CLIENT_ORIGIN || "https://megal-seven.vercel.app";

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
