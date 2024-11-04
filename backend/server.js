const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8080;

// Middleware to parse JSON data
app.use(express.json());
app.use(cors());

let slider1;
let slider2;
let slider3;

// Endpoint to handle the PUT request from front-end
app.put('/2D/api/:sliderName', (req, res) => {
  const { value } = req.body; // Get the slider value from the request body

  if (req.params.sliderName === "angle1") {
    slider1 = value;
    console.log("Slider1 value: ", slider1);
  } else if (req.params.sliderName === "angle2") {
    slider2 = value;
    console.log("Slider2 value: ", slider2);
  } else if (req.params.sliderName === "angle3") {
    slider3 = value;
    console.log("Slider3 value: ", slider3);
  }

  // Respond with a confirmation message
  res.status(200).json({ message: 'Slider value updated', value });
});

// Endpoint to handle the GET request from ESP32
app.get('/2D/api/:sliderName', (req, res) => {
  var value;
  if (req.params.sliderName === "angle1") {
    value = slider1;
  } else if (req.params.sliderName === "angle2") {
    value = slider2;
  } else if (req.params.sliderName === "angle3") {
    value = slider3;
  }
  res.json(value);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
