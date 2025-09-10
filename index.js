
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
    const budgetCollection=db.collection("budgetCollection")
    const questionsCollection=db.collection("questionsCollection")
    const studyPlansCollection=db.collection("studyPlansCollection")
     
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

// Exam Q&A Generator Routes

// Get questions based on criteria
app.get('/api/questions', async (req, res) => {
  try {
    const { subject, topic, difficulty, type, limit } = req.query;
    
    let query = {};
    if (subject) query.subject = subject;
    if (topic) query.topic = topic;
    if (difficulty) query.difficulty = difficulty;
    if (type) query.type = type;
    
    const questions = await questionsCollection
      .find(query)
      .limit(parseInt(limit) || 10)
      .toArray();
    
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new question
app.post('/api/questions', verifyToken, async (req, res) => {
  try {
    const questionData = req.body;
    
    // Validate required fields
    if (!questionData.question || !questionData.answer || !questionData.subject || !questionData.topic) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await questionsCollection.insertOne(questionData);
    res.json({ insertedId: result.insertedId });
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ GET - Get all study plans (filter by user)
app.get('/study-plans', async (req, res) => {
  try {
    const email = req.query.email; // frontend থেকে ?email= দিয়ে পাঠাবে
    const query = email ? { userEmail: email } : {};
    const plans = await studyPlansCollection.find(query).toArray();
    res.send(plans);
  } catch (error) {
    res.status(500).send({ error: 'Failed to fetch study plans' });
  }
});

// ✅ POST - Add new study plan
app.post('/study-plans', async (req, res) => {
  try {
    const newPlan = req.body;
    newPlan.createdAt = new Date();
    newPlan.status = 'pending';
    const result = await studyPlansCollection.insertOne(newPlan);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'Failed to add study plan' });
  }
});

// ✅ PATCH - Update a study plan (mark complete, edit info)
app.patch('/study-plans/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updatedData = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: updatedData };
    const result = await studyPlansCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'Failed to update study plan' });
  }
});

// ✅ DELETE - Remove a study plan
app.delete('/study-plans/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const result = await studyPlansCollection.deleteOne(filter);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'Failed to delete study plan' });
  }


// Get user's question submission history
app.get('/api/user-questions', verifyToken, async (req, res) => {
  try {
    const questions = await questionsCollection
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(questions);
  } catch (error) {
    console.error('Error fetching user questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Budget routes
app.get('/budget/transactions', verifyToken, async (req, res) => {
  try {
    const email = req.query.email;
    
    // Verify that user is accessing their own data
    if (email !== req.user.email) {
      return res.status(403).send({ error: 'Forbidden: You can only access your own transactions' });
    }
    
    const transactions = await budgetCollection.find({ userEmail: email }).sort({ date: -1 }).toArray();
    res.send(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

app.post('/budget/transactions', verifyToken, async (req, res) => {
  try {
    const transactionData = req.body;
    
    // Verify that user is adding to their own account
    if (transactionData.userEmail !== req.user.email) {
      return res.status(403).send({ error: 'Forbidden: You can only add transactions to your own account' });
    }
    
    const result = await budgetCollection.insertOne(transactionData);
    res.send(result);
  } catch (error) {
    console.error('Error adding transaction:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});

app.delete('/budget/transactions/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    
    // First check if the transaction belongs to the user
    const existingTransaction = await budgetCollection.findOne({ 
      _id: new ObjectId(id) 
    });
    
    if (!existingTransaction) {
      return res.status(404).send({ error: 'Transaction not found' });
    }
    
    if (existingTransaction.userEmail !== req.user.email) {
      return res.status(403).send({ error: 'Forbidden: You can only delete your own transactions' });
    }
    
    const result = await budgetCollection.deleteOne({ 
      _id: new ObjectId(id) 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).send({ error: 'Transaction not found' });
    }
    
    res.send(result);
  } catch (error) {
    console.error('Error deleting transaction:', error);
    
    // Handle invalid ObjectId format
    if (error.message.includes('Hex string')) {
      return res.status(400).send({ error: 'Invalid transaction ID format' });
    }
    
    res.status(500).send({ error: 'Internal server error' });
  }
});

app.delete('/budget/transactions', verifyToken, async (req, res) => {
  try {
    const email = req.query.email;
    
    // Verify that user is deleting their own data
    if (email !== req.user.email) {
      return res.status(403).send({ error: 'Forbidden: You can only delete your own transactions' });
    }
    
    const result = await budgetCollection.deleteMany({ userEmail: email });
    res.send(result);
  } catch (error) {
    console.error('Error resetting budget:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});
})
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
