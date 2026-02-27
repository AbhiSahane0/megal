import express from "express";

const app = express();

app.get("/", (_, res) => {
  res.send("This is stater of megal");
});

export default app;
