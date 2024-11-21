
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());


app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api', apiRoutes);

// Reindirizzare tutte le altre richieste a index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server avviato sulla porta ${PORT}`);
});
