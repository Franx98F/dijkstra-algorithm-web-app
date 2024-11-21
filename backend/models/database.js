
const mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',      
    password: '', 
    database: 'dijkstradb'
});

connection.connect(err => {
    if (err) {
        console.error('Errore di connessione al database:', err);
    } else {
        console.log('Connesso al database MySQL!');
    }
});

module.exports = connection;
