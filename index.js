const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const port = process.env.PORT || 5000;
require("dotenv").config();
app.use(cors());
app.use(express.json());

app.use(morgan("dev"));

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4laett8.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect((err) => {
      if (err) {
        console.error(err);
        return;
      }
    });
    const usersCollection = client.db("languageDB").collection("users");
    const classesCollection = client.db("languageDB").collection("classes");
    const instructorsCollection = client
      .db("languageDB")
      .collection("instructors");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    app.put("/users", async (req, res) => {
      const user = re.body;
      const email = req.body.email;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    // get user role
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });
    // get instructors by sort or all
    app.get("/instructors", async (req, res) => {
      const limit = parseInt(req.query.limit) || 0;
      const filter = {};
      let options = {};
      if (limit > 0) {
        options = {
          sort: { students: -1 },
        };
      }
      const result = await instructorsCollection
        .find(filter, options)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    // get classes by sort or all
    app.get("/classes", async (req, res) => {
      const limit = parseInt(req.query.limit) || 0;
      const filter = {};
      let options = {};
      if (limit > 0) {
        options = {
          sort: { students: -1 },
        };
      }
      const result = await classesCollection
        .find(filter, options)
        .limit(limit)
        .toArray();
      res.send(result);
    });
    app.get("/classes", verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { email: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.delete("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Language School is running");
});
app.listen(port, () => {
  console.log(`language school is running on port: ${port}`);
});

// users related apis
// app.get("/users/:email", async (req, res) => {
//   const email = req.params.email;
//   const filter = { email: email };
//   const result = await usersCollection.findOne(filter);
//   res.send(result);
// });
// Warning: use verifyJWT before using verifyAdmin
// const verifyAdmin = async (req, res, next) => {
//   const email = req.decoded.email;
//   const query = { email: email };
//   const user = await usersCollection.findOne(query);
//   if (user?.role !== "admin") {
//     return res
//       .status(403)
//       .send({ error: true, message: "forbidden message" });
//   }
//   next();
// };
// add and update user
// check admin
// app.get("/users/admin/:email", verifyJWT, async (req, res) => {
//   const email = req.params.email;

//   if (req.decoded.email !== email) {
//     res.send({ admin: false });
//   }

//   const query = { email: email };
//   const user = await usersCollection.findOne(query);
//   const result = { admin: user?.role === "admin" };
//   res.send(result);
// });

// app.patch("/users/admin/:id", async (req, res) => {
//   const id = req.params.id;
//   console.log(id);
//   const filter = { _id: new ObjectId(id) };
//   const updateDoc = {
//     $set: {
//       role: "admin",
//     },
//   };

//   const result = await usersCollection.updateOne(filter, updateDoc);
//   res.send(result);
// });
// Classes related api
// app.get("/classes", async (req, res) => {
//   const result = await classesCollection

//     .aggregate([
//       {
//         $addFields: {
//           totalStudents: { $toInt: "$totalStudents" },
//         },
//       },
//       {
//         $sort: { totalStudents: -1 },
//       },
//     ])
//     .toArray();
//   res.send(result);
// });

// app.patch("/classes/:id/select", async (req, res) => {
//   const { id } = req.params;
//   const { action } = req.body;

//   const course = await classesCollection.findOne({ _id: ObjectId(id) });

//   if (!course) {
//     return res.status(404).send({ message: "Course not found" });
//   }

//   if (action === "select") {
//     if (course.availableSeats > 0) {
//       await classesCollection.updateOne(
//         { _id: ObjectId(id) },
//         { $inc: { totalStudents: 1, availableSeats: -1 } }
//       );
//       res.send({ message: "Course selected successfully" });
//     } else {
//       res.status(400).send({ message: "Course is sold out" });
//     }
//   } else if (action === "deselect") {
//     if (course.totalStudents > 0) {
//       await classesCollection.updateOne(
//         { _id: ObjectId(id) },
//         { $inc: { totalStudents: -1, availableSeats: 1 } }
//       );
//       res.send({ message: "Course deselected successfully" });
//     } else {
//       res
//         .status(400)
//         .send({ message: "No students enrolled in the course" });
//     }
//   } else {
//     res.status(400).send({ message: "Invalid action" });
//   }
// });

// app.post("/classes", async (req, res) => {
//   const item = req.body;
//   const result = await classesCollection.insertOne(item);
//   res.send(result);
// });
// Instructors related api
// app.get("/instructors", async (req, res) => {
//   const result = await instructorsCollection.find().toArray();
//   res.send(result);
// });
