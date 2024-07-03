const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000


// middleware
app.use(cors());
app.use(express.json());



console.log(process.env.DB_USER);
console.log(process.env.DB_PASS);


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ehqhw1m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

const tutorCollection = client.db('learnTogether').collection('tutors')
const userCollection = client.db('learnTogether').collection('users')
const studyCollection = client.db('learnTogether').collection('study')
const materialsCollection = client.db('learnTogether').collection('materials')
const bookedCollection = client.db('learnTogether').collection('booked')
const noteCollection = client.db('learnTogether').collection('notes')
const rejectCollection = client.db('learnTogether').collection('rejected')
const commentCollection = client.db('learnTogether').collection('comments')


// JWT Endpoint
app.post('/jwt', async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '1h'
  });
  res.send({ token });
});

// middlewares
const verifyToken = (req, res, next) => {
  console.log('inside verify token', req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

 //verify Admin
 const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  const isAdmin = user?.role === "Admin";
  if (!isAdmin) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};



// app.post('/refresh-token', async (req, res) => {
//   const { token } = req.body;
//   if (!token) {
//       return res.sendStatus(401);
//   }
  
//   try {
//       const user = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
//       const newToken = jwt.sign({ email: user.email }, process.env.ACCESS_TOKEN_SECRET, {
//           expiresIn: '1h',
//       });
//       res.json({ token: newToken });
//   } catch (err) {
//       res.sendStatus(403);
//   }
// });



app.get('/tutor', async(req, res)=>{
  const result = await tutorCollection.find().toArray();
  res.send(result)
})


// user Related api
app.get('/users', verifyToken, verifyAdmin, async (req, res)=>{
  const result = await userCollection.find().toArray()
  res.send(result);
})

// check Admin role
app.get("/users/admin/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  if (email !== req.decoded.email) {
    console.log('email vul');
    return res.status(403).send({ message: "unauthorized access" });
  }

  const query = { email: email };
  const user = await userCollection.findOne(query);
  let admin = false;
  if (user) {
    admin = user.role === "Admin";
  }
  res.send({ admin });
});

// check Tutor role
app.get("/users/tutor/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  if (email !== req.decoded.email) {
    console.log('email vul', res.status(403).send({ message: "unauthorized access" }));
    return res.status(403).send({ message: "unauthorized access" });
  }
  
  const query = { email: email };
  const user = await userCollection.findOne(query);
  let tutor = false;
  if (user) {
    tutor = user?.role === "Tutor";
  }
  res.send({ tutor });
});

// check Student role
app.get("/users/student/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  if (email !== req.decoded.email) {
    console.log('email vul', res.status(403).send({ message: "unauthorized access" }));
    return res.status(403).send({ message: "unauthorized access" });
  }

  const query = { email: email };
  const user = await userCollection.findOne(query);
  let student = false;
  if (user) {
    student = user?.role === "Student";
  }
  res.send({ student });
});

// All-Tutors==============
app.get('/users-tutors', async (req, res) => {
  try {
    const query = { role: "Tutor" }; 
    const result = await userCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// All-Students
app.get('/users-students', async (req, res) => {
  try {
    const query = { role: "Student" }; 
    const result = await userCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});





// users role uploaded
app.post('/users', async (req, res)=>{
  const user = req.body;
  const query = { email: user.email };
  const existingUser = await userCollection.findOne(query);
  if (existingUser) {
    return res.send({ message: "user already exists", insertedId: null });
  }
  const result = await userCollection.insertOne(user);
  res.send(result)
})


// search api
app.get('/search-users', async (req, res) => {
  const { searchTerm } = req.query;

  if (!searchTerm) {
    return res.status(400).json({ message: 'Search term is required' });
  }

  try {
    const query = {
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { role: { $regex: searchTerm, $options: 'i' } }
      ]
    };

    const users = await userCollection.find(query).toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred while searching users', error });
  }
});




app.get('/users', async(req, res)=>{
  const result = await userCollection.find().toArray();
  res.send(result)
})


app.get('/users/:email', async(req, res)=>{
  console.log(req.params.email);
  const result = await userCollection.find({ email: req.params.email }).toArray();
  res.send(result)
})


// study section===========================
app.get('/all-session/:tutorEmail', async (req, res)=>{
  console.log(req.params.tutorEmail);
  const result = await studyCollection.find({ tutorEmail: req.params.tutorEmail}).toArray();
  res.send(result)
} )


// app.get('/study-session', async(req, res)=>{
//   const result = await studyCollection.find().toArray();
//   res.send(result)
// })

app.get('/study-session', async (req, res) => {
  try {
      const result = await studyCollection.find().toArray();
      res.send(result);
  } catch (error) {
      res.status(500).send({ message: 'An error occurred while fetching study sessions.', error });
  }
});

app.post('/study-session', async(req, res)=>{
  const sessionData = req.body;
  const result = await studyCollection.insertOne(sessionData);
  res.send(result)
})

app.delete('/study-session-delete/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await studyCollection.deleteOne(query);

  if (result.deletedCount === 1) {
    res.status(200).json({ message: 'Material deleted successfully', deletedCount: result.deletedCount });
  } else {
    res.status(404).json({ message: 'Material not found' });
  }
});



app.put("/session/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true };
  const updateBlog = req.body;
  const blog = {
    $set: {
      sessionTitle: updateBlog.sessionTitle,
      averageRating: updateBlog.averageRating,
      sessionDescription: updateBlog.sessionDescription,
      registrationStartDate: updateBlog.registrationStartDate,
      registrationEndDate: updateBlog.registrationEndDate,
      classStartTime: updateBlog.classStartTime,
      classEndDate: updateBlog.classEndDate,
        sessionDuration: updateBlog.sessionDuration,
      registrationFee: updateBlog.registrationFee,
      registrationFee: updateBlog.registrationFee,
    },
  };
  const result = await studyCollection.updateOne(filter, blog, options);
  res.send(result);
});

app.post('/materials', async (req, res) => {
  const material = req.body;
  const result = await materialsCollection.insertOne(material);
  res.send(result);
});

app.get('/all-materials', async (req, res)=>{
  const result = await materialsCollection.find().toArray();
  res.send(result)
})
app.get('/all-materials/:tutorEmail', async (req, res)=>{
  console.log(req.params.tutorEmail);
  const result = await materialsCollection.find({ tutorEmail: req.params.tutorEmail}).toArray();
  res.send(result)
})



// Update a material
app.put('/materials-update/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true };
  const updateData = req.body;

  const updateDoc = {
    $set: {
      title: updateData.title,
      imageUrl: updateData.imageUrl,
      link: updateData.link,
    },
  };

  const result = await materialsCollection.updateOne(filter, updateDoc, options);
  res.send(result);
});


// Delete a material
app.delete('/materials-delete/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await materialsCollection.deleteOne(query);

  if (result.deletedCount === 1) {
    res.status(200).json({ message: 'Material deleted successfully', deletedCount: result.deletedCount });
  } else {
    res.status(404).json({ message: 'Material not found' });
  }
});


app.put('/update-user/:id', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  try {
      const result = await userCollection.updateOne(
          { _id: new ObjectId(id) }, // filter
          { $set: { role } } // update
      );
      if (result.modifiedCount === 1) {
          res.json({ message: 'User role updated successfully' });
      } else {
          res.status(404).json({ message: 'User not found' });
      }
  } catch (error) {
      res.status(500).json({ error: 'Something went wrong' });
  }
});

app.put('/update-status/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Correct field is status, not role

  try {
      const result = await studyCollection.updateOne(
          { _id: new ObjectId(id) }, // filter
          { $set: { status } } // update
      );
      if (result.modifiedCount === 1) {
          res.json({ message: 'User status updated successfully' });
      } else {
          res.status(404).json({ message: 'User not found' });
      }
  } catch (error) {
      res.status(500).json({ error: 'Something went wrong' });
  }
});


app.put('/update-price/:id', verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const { status, isFree, amount } = req.body;

  try {
    const result = await studyCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: status,
          registrationFee: isFree ? 0 : amount,
        },
      }
    );
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating status and registration fee");
  }
});


// Delete endpoint
app.delete('/delete-user/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await userCollection.deleteOne({ _id: new ObjectId(id) }); // Using MongoDB's deleteOne with ObjectId
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});



// Book Session
app.post("/book-session", async (req, res) => {
  const { studentEmail, sessionId, tutorEmail, sessionInfo } = req.body;

  try {
    const existingBooking = await bookedCollection.findOne({
      studentEmail: studentEmail,
      sessionId: sessionId
    });
    if (existingBooking) {
      return res.status(409).send("Session already booked.");
    }

    const bookedSession = {
      studentEmail,
      sessionId,
      tutorEmail,
      sessionInfo,
    };

    const result = await bookedCollection.insertOne(bookedSession);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error booking session");
  }
});



app.get('/book-all/:studentEmail', async (req, res)=>{
  console.log(req.params.tutorEmail);
  const result = await bookedCollection.find({ studentEmail: req.params.studentEmail}).toArray();
  res.send(result)
})


app.get('/all-material/:sessionId', async (req, res)=>{
  console.log(req.params.sessionId);
  const result = await materialsCollection.find({ sessionId: req.params.sessionId}).toArray();
  res.send(result)
})


app.get('/notes/:email', async(req, res)=>{
  const result  = await noteCollection.find({ email: req.params.email}).toArray();
  res.send(result)
})

app.post("/notes", async(req, res)=>{
  const newNote = req.body;
  const result = await noteCollection.insertOne(newNote);
  res.send(result)
})

app.post("/rejected-sessions", async(req, res)=>{
  const newNote = req.body;
  const result = await rejectCollection.insertOne(newNote);
  res.send(result)
})




    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { registrationFee } = req.body;
      const amount = parseInt(registrationFee * 100);
    
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"]
        });
    
        res.send({
          clientSecret: paymentIntent.client_secret
        });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ error: "Failed to create payment intent" });
      }
    });

    app.get('/comment/:commentId', async (req, res)=>{
      const result = await commentCollection.find({commentId: req.params.commentId}).toArray();
      res.send(result)
    })

    app.post('/comment', async (req, res)=>{
      const newComment = req.body;
      const result = await commentCollection.insertOne(newComment);
      res.send(result)
    })



  

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res)=> {
    res.send('learn together')
})

app.listen(port, ()=>{
    console.log('learn together is running');
})