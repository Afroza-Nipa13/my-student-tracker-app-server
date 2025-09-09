
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173'], 
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@clusterph.bwaiqag.mongodb.net/?retryWrites=true&w=majority&appName=ClusterPH`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected Successfully");

    const db = client.db("studentTracker");
    const usersCollection = db.collection("usersCollection");
    const classesCollection=db.collection("classesCollection")


     const verifyToken = async (req, res, next) => {
      const token = req.cookies?.token

      if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          console.log(err)
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded
        next()
      })
    }


    // Generate jwt token
    app.post('/jwt', async (req, res) => {
      const { email } = req.body; // destructuring
      if (!email) {
        return res.status(400).send({ message: 'Email is required' });
      }

      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: '365d',
      });

      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

     // Logout
    app.get('/logout', async (req, res) => {
      try {
        res.clearCookie('token', {
          maxAge: 0,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
          .send({ success: true })
      } catch (err) {
        res.status(500).send(err)
      }
    })
    // Sample route
    app.get("/", (req, res) => {
      res.send("API is running...");
    });

    // Example: Get all users
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    // Example: Add user
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });


    // Get classes for a specific user
app.get('/classes', async (req, res) => {
  try {
    const email = req.query.email;
    const classes = await classesCollection.find({ userEmail: email }).toArray();
    res.send(classes);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Add a new class
app.post('/classes', async (req, res) => {
  try {
    const classData = req.body;
    const result = await classesCollection.insertOne(classData);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Update a class
app.put('/classes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const classData = req.body;
    const result = await classesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: classData }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Delete a class
app.delete('/classes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await classesCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

  } finally {
    // Optional: close connection when needed
    // await client.close();
  }
}
run().catch(console.dir);

// Server Listen
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
