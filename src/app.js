
const cors = require('cors');
const express = require('express');
const morgan = require('morgan');


const app = express();
app.use(cors({
    origin: process.env.ORIGIN,
    credentials: true
})); 

const productRoutes = require('./routes/productRoutes');


app.use(express.json());
app.use(morgan('dev'));

app.use("/api/products", productRoutes);

app.get('/', (req, res) => {
  res.json({
    message: "Fetched users successfully!"
  });
});

module.exports = app;
