import app from "./app";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { CreateSocketConnection } from "./socket.io/CreateSocketConnection";
// creating new server
const server = createServer(app);

// creating new socket.io server
const io = new Server(server, {
  cors: {
    origin: "https://megal-seven.vercel.app",
    methods: ["GET,HEAD,PUT,PATCH,POST,DELETE"],
    // credentials: true,
  },
});

CreateSocketConnection(io);

server.listen(process.env.PORT || 3000, () => {
  console.log("Server listening on port 3000");
});

export { io, server };
