const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const port = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

// middleware
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];

  // verify
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
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
    const serviceCollection = client.db("languageDB").collection("services");
    const usersCollection = client.db("languageDB").collection("users");
    const reviewsCollection = client.db("languageDB").collection("reviews");
    const classesCollection = client.db("languageDB").collection("classes");
    const studentCollection = client.db("languageDB").collection("students");
    const selectCollection = client
      .db("languageDB")
      .collection("select_classes");
    const enrolledCollection = client
      .db("languageDB")
      .collection("enrolled_classes");
    const paymentHistoryCollection = client
      .db("languageDB")
      .collection("payment_history");
    const instructorsCollection = client
      .db("languageDB")
      .collection("instructors");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const filter = { email: email };
      const result = await studentCollection.findOne(filter);
      console.log("check admin", result);

      if (result?.role !== "admin") {
        return res
          .status(401)
          .send({ error: true, message: "access forbidden" });
      }
      next();
    };
    // verify instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const filter = { email: email };
      const result = await studentCollection.findOne(filter);
      console.log("check admin", result);

      if (result?.role !== "instructor") {
        return res
          .status(401)
          .send({ error: true, message: "access forbidden" });
      } else {
        next();
      }
    };
    // create payment intent
    app.post("/create_payment_intent", async (req, res) => {
      const { price } = req.body;

      if (price) {
        const amount = parseFloat(price) * 100;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ client_secret: paymentIntent.client_secret });
      }
    });
    // create token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });

      res.send({ token });
    });

    // add and update user
    app.put("/students", async (req, res) => {
      const user = req.body;
      const email = req.body.email;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };

      const result = await studentCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    // get user role
    app.get("/students/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await studentCollection.findOne(query);
      res.send(user);
    });
    // get instructor by sort or all
    app.get("/instructors", async (req, res) => {
      const limit = parseInt(req.query.limit) || 0;
      const filter = { role: "instructor" };
      let options = {};
      if (limit > 0) {
        options = {
          sort: { students: -1 },
        };
      }

      const result = await studentCollection
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
        options = { sort: { enrolled: -1 } };
      }

      const result = await classesCollection
        .find(filter, options)
        .limit(limit)
        .toArray();
      res.send(result);
    });
    // post select item
    app.post("/select_classes", verifyJWT, async (req, res) => {
      const selectItem = req.body;
      console.log("select item", selectItem);
      const result = await selectCollection.insertOne(selectItem);
      res.send(result);
    });
    // get selected items by email
    app.get("/selectedItems/:email", verifyJWT, async (req, res) => {
      if (req.decoded?.email !== req.params.email) {
        res.status(403).send({ error: true, message: "Forbidden" });
      }
      const email = req.params.email;
      console.log(email);
      const filter = { email: email };
      const result = await selectCollection.find(filter).toArray();
      res.send(result);
    });
    // delete selected class
    app.delete("/selectedItems/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await selectCollection.deleteOne(filter);
      res.send(result);
    });
    // instructor api
    // create a new class
    app.post("/add_class", verifyJWT, verifyInstructor, async (req, res) => {
      if (req.decoded?.email !== req.body?.instructor_email) {
        res.status(403).send({ error: true, message: "Forbidden" });
      }
      const classItem = req.body;
      console.log(classItem);
      const result = await classesCollection.insertOne(classItem);
      res.send(result);
    });

    // get class by instructor email
    app.get(
      "/classes/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        if (req.decoded.email !== req?.params?.email) {
          return res.status(403).send({ error: true, message: "Forbidden" });
        }
        const email = req.params.email;
        const filter = { instructor_email: email };
        console.log(filter);
        const result = await classesCollection.find(filter).toArray();

        res.send(result);
      }
    );
    // admin route
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await studentCollection.find().toArray();
      res.send(result);
    });
    // make admin
    app.patch("/users/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const userRole = req.body;
      console.log(userRole);
      const filter = { email: email };
      const updatedDoc = {
        $set: {
          role: userRole.role,
        },
      };
      const result = await studentCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // get class by id
    app.get("/myClasses/:id", verifyJWT, verifyInstructor, async (req, res) => {
      const id = req.params.id;
      console.log("for checking", id);
      const filter = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(filter);
      res.send(result);
    });
    // get selected class by id
    app.get("/selected_classes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await selectCollection.findOne(filter);
      res.send(result);
    });
    // get enrolled class by email
    app.get("/enrolledClasses/:email", verifyJWT, async (req, res) => {
      if (req.decoded.email !== req.params.email) {
        return res.status(403).send({ error: true, message: "Forbidden" });
      }
      const email = req.params.email;
      const filter = { email: email };
      const result = await enrolledCollection.find(filter).toArray();
      res.send(result);
    });
    // get payment history
    app.get("/payment_history/:email", verifyJWT, async (req, res) => {
      if (req.decoded.email !== req.params.email) {
        return res.status(403).send({ error: true, message: "Forbidden" });
      }
      const email = req.params.email;
      const filter = { email: email };
      const result = await paymentHistoryCollection.find(filter).toArray();
      res.send(result);
    });
    // update class status
    app.patch("/classes/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const classInfo = req.body;

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: { status: classInfo.status },
      };

      const result = await classesCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    app.post("/payment", verifyJWT, async (req, res) => {
      const paymentInfo = req.body;
      console.log("paymentInfo", paymentInfo);
      // save payment history
      const saved_history_result = await paymentHistoryCollection.insertOne(
        paymentInfo.payment_history
      );
      const class_update_filter = {
        _id: new ObjectId(paymentInfo.update_class.classId),
      };
      const class_update_doc = {
        $set: {
          seats: paymentInfo?.update_class.seats,
          enrolled: paymentInfo?.update_class.enrolled,
        },
      };
      // update seats
      const class_update_result = await classesCollection.updateOne(
        class_update_filter,
        class_update_doc
      );

      // update enrolled
      // const update_enrolled_result =

      // saved to enrolled class
      const save_enrolled_result = await enrolledCollection.insertOne(
        paymentInfo.enrolled_info
      );

      // update instructor enrolled
      const update_instructor_enrolled_filter = {
        email: paymentInfo?.enrolled_info?.instructor_email,
      };
      const update_instructor_enrolled_UpdateDoc = {
        $set: {
          students: paymentInfo?.update_class?.enrolled,
        },
      };

      const update_instructor_enrolled_result =
        await studentCollection.updateOne(
          update_instructor_enrolled_filter,
          update_instructor_enrolled_UpdateDoc
        );

      console.log(
        "update_instructor_enrolled_result",
        update_instructor_enrolled_result
      );

      // deleted selected class
      const delete_selected_filter = {
        _id: new ObjectId(paymentInfo.selectedId),
      };
      const delete_selected_result = await selectCollection.deleteOne(
        delete_selected_filter
      );

      res.send(delete_selected_result);
    });
    // update class
    app.put("/classes/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const updateClass = req.body;
      const filter = { _id: new ObjectId(id) };
      console.log(updateClass);
      const updatedDoc = {
        $set: {
          ...updateClass,
        },
      };
      const result = await classesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // add feedback
    app.patch(
      "/feedback/classes/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const classFeedback = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            feedback: classFeedback.feedback,
          },
        };

        const result = await classesCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    // class delete by id
    app.delete("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await classesCollection.deleteOne(filter);
      res.send(result);
    });
    // app.put("/users", async (req, res) => {
    //   const user = re.body;
    //   const email = req.body.email;
    //   const filter = { email: email };
    //   const options = { upsert: true };
    //   const updatedDoc = {
    //     $set: user,
    //   };
    //   const result = await usersCollection.updateOne(
    //     filter,
    //     updatedDoc,
    //     options
    //   );
    //   res.send(result);
    // });
    // // get user role
    // app.get("/users/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const query = { email: email };
    //   const user = await usersCollection.findOne(query);
    //   res.send(user);
    // });
    // // get instructors by sort or all
    // app.get("/instructors", async (req, res) => {
    //   const limit = parseInt(req.query.limit) || 0;
    //   const filter = {};
    //   let options = {};
    //   if (limit > 0) {
    //     options = {
    //       sort: { students: -1 },
    //     };
    //   }
    //   const result = await instructorsCollection
    //     .find(filter, options)
    //     .limit(limit)
    //     .toArray();
    //   res.send(result);
    // });

    // // get classes by sort or all
    // app.get("/classes", async (req, res) => {
    //   const limit = parseInt(req.query.limit) || 0;
    //   const filter = {};
    //   let options = {};
    //   if (limit > 0) {
    //     options = {
    //       sort: { students: -1 },
    //     };
    //   }
    //   const result = await classesCollection
    //     .find(filter, options)
    //     .limit(limit)
    //     .toArray();
    //   res.send(result);
    // });
    // app.get("/classes", verifyJWT, async (req, res) => {
    //   const email = req.query.email;

    //   if (!email) {
    //     res.send([]);
    //   }

    //   const decodedEmail = req.decoded.email;
    //   if (email !== decodedEmail) {
    //     return res
    //       .status(403)
    //       .send({ error: true, message: "forbidden access" });
    //   }

    //   const query = { email: email };
    //   const result = await classesCollection.find(query).toArray();
    //   res.send(result);
    // });

    // app.post("/users", async (req, res) => {
    //   const user = req.body;
    //   console.log(user);
    //   const query = { email: user.email };
    //   const existingUser = await usersCollection.findOne(query);
    //   if (existingUser) {
    //     return res.send({ message: "user already exists" });
    //   }
    //   const result = await usersCollection.insertOne(user);
    //   res.send(result);
    // });

    // app.delete("/classes/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await classesCollection.deleteOne(query);
    //   res.send(result);
    // });
    // // review related apis
    // app.get("/reviews", async (req, res) => {
    //   const result = await reviewsCollection.find().toArray();
    //   res.send(result);
    // });
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
