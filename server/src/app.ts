import express from "express";

const app = express();

app.get("/", (_, res) => {
  res.send("Megal server is running");
});

export default app;
