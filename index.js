const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Language School is running");
});
app.listen(port, () => {
  console.log(`language school is running on port: ${port}`);
});
