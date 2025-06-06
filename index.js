import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supportedCoins = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
];

const coingecko = axios.create({
  baseURL: "https://api.coingecko.com/api/v3",
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  },
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// GET /
app.get("/", async (req, res) => {
  const ids = supportedCoins.map((c) => c.id).join(",");

  try {
    const { data } = await coingecko.get("/coins/markets", {
      params: {
        vs_currency: "usd",
        ids: ids,
        price_change_percentage: "24h",
      },
    });

    const coinsWithMeta = supportedCoins.map((coin) => {
      const live = data.find((d) => d.id === coin.id);
      return {
        ...coin,
        image: live?.image,
        price: live?.current_price,
      };
    });

    res.render("index", { coins: coinsWithMeta, results: null });
  } catch (err) {
    console.error(err.message);
    res.send("Error loading market data.");
  }
});

// POST /
app.post("/", async (req, res) => {
  const formData = req.body;
  const selectedCoins = Object.keys(formData).filter((key) => formData[key]);
  const ids = supportedCoins.map((c) => c.id).join(",");

  try {
    const { data } = await coingecko.get("/coins/markets", {
      params: {
        vs_currency: "usd",
        ids: ids,
        price_change_percentage: "24h",
      },
    });

    const coinsWithMeta = supportedCoins.map((coin) => {
      const live = data.find((d) => d.id === coin.id);
      return {
        ...coin,
        image: live?.image,
        price: live?.current_price,
      };
    });

    let total = 0;
    const results = [];

    for (const coin of data) {
      if (!formData[coin.id]) continue;

      const amount = parseFloat(formData[coin.id]);
      const value = amount * coin.current_price;
      const change = coin.price_change_percentage_24h;

      // Fetch sparkline data
      let sparkline = [];
      try {
        const sparklineResponse = await coingecko.get(
          `/coins/${coin.id}/market_chart`,
          {
            params: { vs_currency: "usd", days: 7 },
          }
        );
        sparkline = sparklineResponse.data.prices.map((p) => p[1]);
      } catch (sparkErr) {
        console.error(`Sparkline error for ${coin.id}:`, sparkErr.message);
      }

      results.push({
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        image: coin.image,
        amount,
        price: coin.current_price,
        value,
        change,
        sparkline,
      });

      total += value;
    }

    res.render("index", {
      coins: coinsWithMeta,
      results: {
        items: results,
        total: total.toFixed(2),
      },
    });
  } catch (error) {
    console.error(error.message);
    res.send("Error fetching prices. Try again later.");
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
