const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5001;

// Enable CORS for the frontend
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// SQLite setup
const db = new sqlite3.Database("./auction.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  } else {
    console.log("Connected to SQLite database.");

    // Create English Auctions table
    db.run(
      `
      CREATE TABLE IF NOT EXISTS english_auctions (
        auction_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        product_image TEXT NOT NULL,
        highest_bid TEXT DEFAULT "0",
        highest_bidder TEXT DEFAULT "0x0000000000000000000000000000000000000000",
        auction_end_time INTEGER DEFAULT NULL,
        min_bid_increment REAL NOT NULL,
        auction_ended BOOLEAN DEFAULT FALSE,
        owner_id TEXT NOT NULL
      )
      `,
      (err) => {
        if (err) console.error("Error creating english_auctions table:", err.message);
        else console.log("English Auctions table ensured.");
      }
    );

    // Create Second Price Auctions table
    db.run(
      `
      CREATE TABLE IF NOT EXISTS second_price_auctions (
        auction_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        product_image TEXT NOT NULL,
        highest_bid TEXT DEFAULT "0",
        second_highest_bid TEXT DEFAULT "0",
        highest_bidder TEXT DEFAULT "0x0000000000000000000000000000000000000000",
        auction_end_time INTEGER DEFAULT NULL,
        auction_ended BOOLEAN DEFAULT FALSE,
        owner_id TEXT NOT NULL
      )
      `,
      (err) => {
        if (err) console.error("Error creating second_price_auctions table:", err.message);
        else console.log("Second Price Auctions table ensured.");
      }
    );
  }
});

// Helper function to convert an image to Base64
const convertImageToBase64 = (imagePath) => {
  try {
    const absolutePath = path.resolve(__dirname, imagePath);
    const imageBuffer = fs.readFileSync(absolutePath);
    return imageBuffer.toString("base64");
  } catch (err) {
    console.error(`Error converting image at ${imagePath} to Base64:`, err.message);
    return null;
  }
};

// Prepopulate Auctions Directly
app.get("/api/prepopulate", (req, res) => {
  const images = [
    { productName: "pic1", productImage: convertImageToBase64("../public/pic1.jpeg") },
    { productName: "pic2", productImage: convertImageToBase64("../public/pic2.jpg") },
    { productName: "pic3", productImage: convertImageToBase64("../public/pic3.jpeg") },
  ];

  const englishQuery = `
    INSERT INTO english_auctions (product_name, product_image, auction_end_time, min_bid_increment, auction_ended, owner_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const secondPriceQuery = `
    INSERT INTO second_price_auctions (product_name, product_image, auction_end_time, auction_ended, owner_id)
    VALUES (?, ?, ?, ?, ?)
  `;

  const ownerId = "0x76a11fa6066F1a9577989ea539BF1415A400cA6a"; // Hardcoded owner ID
  const auctionEndTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours from now

  images.forEach(({ productName, productImage }) => {
    if (productImage) {
      // Insert into English Auctions
      db.run(
        englishQuery,
        [productName, productImage, auctionEndTime, 1, false, ownerId],
        (err) => {
          if (err) console.error(`Error inserting into English Auctions: ${productName}`, err.message);
        }
      );

      // Insert into Second Price Auctions
      db.run(
        secondPriceQuery,
        [productName, productImage, auctionEndTime, false, ownerId],
        (err) => {
          if (err) console.error(`Error inserting into Second Price Auctions: ${productName}`, err.message);
        }
      );
    } else {
      console.error(`Skipped inserting ${productName} due to missing image.`);
    }
  });

  res.json({ message: "Auctions prepopulated successfully." });
});

// Get all English auctions
app.get("/api/english-auctions", (req, res) => {
  const query = "SELECT * FROM english_auctions";
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json(rows);
  });
});

// Get all Second Price auctions
app.get("/api/second-price-auctions", (req, res) => {
  const query = "SELECT * FROM second_price_auctions";
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json(rows);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});