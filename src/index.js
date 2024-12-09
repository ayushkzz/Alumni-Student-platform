// Import required modules
const express = require("express");
const path = require("path");
const session = require("express-session");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const { User, Message, connectMongoDB } = require("./mongo");
const app = express();

// App configuration
dotenv.config();
const port = process.env.PORT || 3000;
const templatePath = path.join(__dirname, "../templates");
const publicPath = path.join(__dirname, "../public");

// MongoDB connection
connectMongoDB();

const server = http.createServer(app); // Use http.createServer to pass to socket.io
const io = new Server(server); // Create socket.io server with the HTTP server

// Constants
const saltRounds = 10; // Salt rounds for password hashing

// Middleware Configuration
app.set("view engine", "hbs");
app.set("views", templatePath);
app.use(express.static(publicPath));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session Configuration
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set true if using HTTPS
  })
);

// ** WebSocket Configuration (Socket.io) **
let socketsConnected = new Set();

io.on("connection", (socket) => {
  console.log("Socket connected", socket.id);
  socketsConnected.add(socket.id);
  io.emit("clients-total", socketsConnected.size);

  socket.on("disconnect", () => {
    console.log("Socket disconnected", socket.id);
    socketsConnected.delete(socket.id);
    io.emit("clients-total", socketsConnected.size);
  });

  socket.on("message", (data) => {
    socket.broadcast.emit("chat-message", data); // Broadcast message to other clients
  });

  socket.on("feedback", (data) => {
    socket.broadcast.emit("feedback", data); // Broadcast feedback to other clients
  });
});

// ** Routes **

// Home route
app.get("/", (req, res) => res.render("home"));

// Signup page
app.get("/signup", (req, res) => res.render("signup"));

// Login page
app.get("/login", (req, res) => res.render("login"));

// Logged-in homepage
app.get("/home-login", (req, res) => {
  if (req.session && req.session.loggedIn) {
    res.render("home-login", { name: req.session.user });
  } else {
    res.redirect("/login");
  }
});

// ** Signup Logic **
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.render("signup", { errorMessage: "User already exists" });
    }

    // Encrypt the password before saving
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    req.session.loggedIn = true;
    req.session.user = name;
    res.redirect("/home-login");
  } catch (error) {
    console.error("Error during signup:", error);
    res.render("signup", { errorMessage: "An error occurred. Please try again." });
  }
});

// ** Login Logic **
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render("login", { errorMessage: "Invalid email or password" });
    }

    // Compare hashed password with entered password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.render("login", { errorMessage: "Invalid email or password" });
    }

    req.session.loggedIn = true;
    req.session.user = user.name;
    res.redirect("/home-login");
  } catch (error) {
    console.error("Error during login:", error);
    res.render("login", { errorMessage: "An error occurred. Please try again." });
  }
});

// ** Logout Logic **
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error during logout:", err);
      res.status(500).send("An error occurred while logging out.");
    } else {
      res.clearCookie("connect.sid");
      res.redirect("/");
    }
  });
});

// Render the edit profile page
app.get('/edit-profile', async (req, res) => {
    if (req.session && req.session.loggedIn) {
        try {
            // Find the user based on session data
            const user = await User.findOne({ name: req.session.user });

            if (!user) {
                return res.redirect('/login');
            }

            // Render the edit-profile page with user data
            res.render('edit-profile', { user });
        } catch (error) {
            console.error('Error fetching user profile:', error);
            res.status(500).send('An error occurred while loading the edit profile page.');
        }
    } else {
        res.redirect('/login');
    }
});


app.post('/edit-profile', async (req, res) => {
    if (req.session && req.session.loggedIn) {
        const { password, newName } = req.body;

        try {
            // Find the user based on session data
            const user = await User.findOne({ name: req.session.user });

            // If user doesn't exist or password is incorrect
            if (!user) {
                return res.render('edit-profile', { errorMessage: 'User not found.' });
            }

            const isPasswordCorrect = await bcrypt.compare(password, user.password);
            if (!isPasswordCorrect) {
                return res.render('edit-profile', { user, errorMessage: 'Incorrect password. Please try again.' });
            }

            // Update the user's name if password verification passes
            await User.updateOne(
                { name: req.session.user },
                { $set: { name: newName } }
            );

            // Update session user name
            req.session.user = newName;

            res.redirect('/home-login');
        } catch (error) {
            console.error('Error updating profile:', error);
            res.render('edit-profile', { errorMessage: 'An error occurred while updating the profile. Please try again later.' });
        }
    } else {
        res.redirect('/login');
    }
});

// ** Chat Routes **

// Chat page
app.get("/chat", (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect("/login");
  }

  res.render("chat", { username: req.session.user });
});

// Start server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});