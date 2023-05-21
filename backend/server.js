const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const sgMail = require("@sendgrid/mail");
const saltRounds = 10;
const app = express();

require("dotenv").config();

app.use(cors());
app.use(bodyParser.json());

mongoose.connect("mongodb://localhost:27017/users", { useNewUrlParser: true });

sgMail.setApiKey(process.env.API_KEY);

const userSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    username: String,
    password: String,
    isAdmin: Boolean,
});

const carSchema = new mongoose.Schema({
    name: String,
    year: Number,
    category: String,
    image: String,
    seats: Number,
    fuel: String,
    quantity: Number,
    price: Number,
});

const reservationSchema = new mongoose.Schema({
    userID: { type: String, ref: "User" },
    carID: { type: mongoose.Schema.Types.ObjectId, ref: "Car" },
    carName: String,
    startDate: Date,
    endDate: Date,
    price: Number,
    status: String,
});

const codeSchema = new mongoose.Schema({
    code: {
        type: String,
        unique: true,
    },
});

const User = mongoose.model("User", userSchema);
const Car = mongoose.model("Car", carSchema);
const Reservation = mongoose.model("Reservation", reservationSchema);
const Code = mongoose.model("Code", codeSchema);

app.post("/api/register", async (req, res) => {
    const { firstName, lastName, username, password } = req.body;

    if (!firstName || !lastName || !username || !password) {
        return res.status(400).send("All fields are required");
    }

    // Check if the username already exists in the database
    const existingUser = await User.findOne({ username });
    if (existingUser) {
        return res.status(409).send("Username already exists");
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create a new user object
    const newUser = new User({
        firstName,
        lastName,
        username,
        password: hashedPassword,
        isAdmin: false,
    });

    try {
        await newUser.save();
        res.status(201).send({ message: "User created successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find the user in the database
        const user = await User.findOne({ username });

        // If the user doesn't exist, send an error message
        if (!user) {
            return res
                .status(401)
                .json({ message: "Invalid username or password" });
        }

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) {
            return res
                .status(401)
                .json({ message: "Invalid username or password" });
        }

        const token = jwt.sign({ username }, "my-secure-string", {
            expiresIn: "1h",
        });

        // If the password matches, send a success message
        res.status(200).json({
            message: "Login successsssful",
            token: token,
            _id: user._id,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/admin/cars", async (req, res) => {
    const { name, year, category, image, seats, fuel, quantity, price } =
        req.body;

    console.log(req.body);
    if (
        !name ||
        !year ||
        !category ||
        !image ||
        !seats ||
        !fuel ||
        !quantity ||
        !price ||
        isNaN(parseInt(year)) ||
        parseInt(year) < 1900 ||
        parseInt(year) > 2100 ||
        isNaN(parseInt(quantity)) ||
        parseInt(quantity) <= 0 ||
        isNaN(parseFloat(price)) ||
        parseFloat(price) <= 0
    ) {
        res.status(400).json({ message: "Invalid input fields" });
        return;
    }
    try {
        const car = await Car.findOne({ name });
        if (car) {
            numberedCarQuantity = parseInt(car.quantity);
            numberedQuantity = parseInt(quantity);
            car.quantity = numberedCarQuantity + numberedQuantity;
            await car.save();
        } else {
            const newCar = new Car({
                name,
                year,
                category,
                image,
                seats,
                fuel,
                quantity,
                price,
            });
            await newCar.save();
        }
        res.status(200).send({ message: "Car added successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/admin/check", async (req, res) => {
    const { username } = req.body;
    try {
        const user = await User.findOne({ username: username });
        if (user.isAdmin === true) {
            res.status(200).json({ message: "A fost gasit" });
        } else res.status(500).json({ message: "Nu a fost gasit" });
    } catch (err) {
        console.error(err);
        res.status(500);
    }
});

app.put("/admin/cars", async (req, res) => {
    const { name, year, image, seats, fuel, quantity, price } = req.body;
    if (
        !quantity ||
        !price ||
        isNaN(parseInt(quantity)) ||
        parseInt(quantity) <= 0 ||
        isNaN(parseFloat(price)) ||
        parseFloat(price) <= 0
    ) {
        res.status(400).json({ message: "Invalid input fields" });
        return;
    }
    try {
        const car = await Car.findOne({ name });
        if (car) {
            car.quantity = quantity;
            car.price = price;
            car.image = image;
            console.log(car);
            await car.save();
        }
        res.status(200).send({ message: "Car added successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/search", async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        const stDate = new Date(startDate);
        const enDate = new Date(endDate);

        const cars = await Car.find();
        const carReservations = await Reservation.find();

        carReservations.map((reservation) => {
            if (reservation.status === "Active") {
                if (
                    (stDate < reservation.startDate &&
                        enDate > reservation.startDate) ||
                    (stDate < reservation.endDate &&
                        enDate > reservation.startDate)
                ) {
                    cars.forEach((car) => {
                        if (
                            car._id.toString() == reservation.carID.toString()
                        ) {
                            car.quantity -= 1;
                        }
                    });
                }
            }
        });

        const filteredCars = cars.filter((car) => car.quantity > 0);
        res.json({ filteredCars, debug: carReservations.length });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

function generateRandomNumber() {
    return Math.floor(Math.random() * 9000000) + 1000000;
}

app.post("/api/book", async (req, res) => {
    const { userID, carID, carName, startDate, endDate } = req.body;

    const reservation = new Reservation({
        userID,
        carID,
        carName,
        startDate,
        endDate,
        status: "Pending",
    });

    try {
        await reservation.save();
        const random = generateRandomNumber();
        if (userID) {
            const message = {
                to: userID,
                from: "modorcearoberto@gmail.com",
                subject: "Please confirm your reservation",
                text: `Your reservation code is: ${random}`,
            };
            sgMail.send(message);
        }

        const code = new Code({ code: random });
        await code.save();
        res.status(201).send({ message: "Reservation created successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/reservations", async (req, res) => {
    try {
        const { username } = req.body;
        // console.log(user);
        const currentUser = await User.find({ username: username });
        const reservationList = await Reservation.find({ userID: username });

        res.json({ reservationList, username: username });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/user/check", async (req, res) => {
    const { user } = req.body;
    try {
        const reservations = await Reservation.find({ userID: user });
        res.status(200).json(reservations);
    } catch (err) {
        res.status(500).json({ message: "Error fetching reservations" });
    }
    const reservations = await Reservation.find({});
});

app.put("/user/verify", async (req, res) => {
    const { code, id, userID } = req.body;
    try {
        const checkedCode = await Code.find({ code });
        if (checkedCode.length) {
            await Reservation.findByIdAndUpdate(id, { status: "Active" });
            const message = {
                to: userID,
                from: "modorcearoberto@gmail.com",
                subject: "Confirmation",
                text: `Your reservation has been successfully confirmed`,
            };

            sgMail.send(message);
            res.status(200).json({ message: "Updated Successfully" });
        } else {
            res.status(500).json({ message: "Failed to verify" });
        }
    } catch (err) {
        res.status(500).json({ message: "Failed to verify" });
    }
});

app.get("/api/allreservations", async (req, res) => {
    try {
        const reservations = await Reservation.find();
        res.json(reservations);
    } catch (err) {
        res.status(500).json({ message: "Error fetching reservations" });
    }
});

app.get("/api/allusers", async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Error fetching users" });
    }
});

app.get("/api/allcars", async (req, res) => {
    try {
        const cars = await Car.find();
        console.log(cars);
        res.json(cars);
    } catch (err) {
        res.status(500).json({ message: "Error fetching cars" });
    }
});

app.get("/", (req, res) => {
    res.send("Buna seara dragilor");
});

app.delete("/api/users", async (req, res) => {
    try {
        const { _id } = req.body;
        await User.deleteOne({ _id: _id });
        res.status(200).json({ message: "Success" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

app.listen(5002);
