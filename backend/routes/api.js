
const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.post('/nodes', (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).send('Il nome del nodo è obbligatorio.');
    }
    const query = 'INSERT INTO nodes (name) VALUES (?)';
    db.query(query, [name], (err) => {
        if (err) {
            console.error(err);
            res.status(500).send('Errore nell\'aggiungere il nodo.');
        } else {
            res.send('Nodo aggiunto con successo.');
        }
    });
});

router.get('/nodes', (req, res) => {
    const query = 'SELECT * FROM nodes';
    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Errore nel recuperare i nodi.');
        } else {
            res.json(results);
        }
    });
});

router.post('/edges', (req, res) => {
    const { fromNode, toNode, weight } = req.body;
    if (!fromNode || !toNode || !weight) {
        return res.status(400).send('Tutti i campi sono obbligatori.');
    }

    // Funzione per ottenere l'ID del nodo dato il nome
    const getNodeId = (name) => new Promise((resolve, reject) => {
        const query = 'SELECT id FROM nodes WHERE name = ?';
        db.query(query, [name], (err, results) => {
            if (err) {
                console.error(err);
                reject(new Error('Errore nel recuperare il nodo dal database.'));
            } else if (results.length === 0) {
                reject(new Error(`Nodo "${name}" non trovato.`));
            } else {
                resolve(results[0].id);
            }
        });
    });

    // Recupera gli ID dei nodi di partenza e arrivo
    Promise.all([getNodeId(fromNode), getNodeId(toNode)])
        .then(([fromNodeId, toNodeId]) => {
            const query = 'INSERT INTO edges (fromNode, toNode, weight) VALUES (?, ?, ?)';
            db.query(query, [fromNodeId, toNodeId, weight], (err) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Errore nell\'aggiungere l\'arco al database.');
                } else {
                    res.send('Arco aggiunto con successo.');
                }
            });
        })
        .catch(err => {
            console.error(err);
            res.status(400).send(err.message);
        });
});

router.get('/edges', (req, res) => {
    const query = `
        SELECT e.id, n1.name AS fromNodeName, n2.name AS toNodeName, e.weight, e.fromNode, e.toNode
        FROM edges e
        JOIN nodes n1 ON e.fromNode = n1.id
        JOIN nodes n2 ON e.toNode = n2.id
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Errore nel recuperare gli archi.');
        } else {
            res.json(results);
        }
    });
});

router.post('/dijkstra', (req, res) => {
    const { startNode, endNode } = req.body;
    if (!startNode || !endNode) {
        return res.status(400).send('Tutti i campi sono obbligatori.');
    }

    // Funzione per ottenere tutti i nodi
    const getNodes = () => new Promise((resolve, reject) => {
        const query = 'SELECT * FROM nodes';
        db.query(query, (err, results) => {
            if (err) {
                console.error(err);
                reject(new Error('Errore nel recuperare i nodi.'));
            } else {
                resolve(results);
            }
        });
    });

    // Funzione per ottenere tutti gli archi
    const getEdges = () => new Promise((resolve, reject) => {
        const query = 'SELECT * FROM edges';
        db.query(query, (err, results) => {
            if (err) {
                console.error(err);
                reject(new Error('Errore nel recuperare gli archi.'));
            } else {
                resolve(results);
            }
        });
    });

    Promise.all([getNodes(), getEdges()])
        .then(([nodes, edges]) => {
            // Costruzione del grafo
            const graph = {};
            nodes.forEach(node => {
                graph[node.name] = {};
            });

            edges.forEach(edge => {
                const fromNode = nodes.find(n => n.id === edge.fromNode).name;
                const toNode = nodes.find(n => n.id === edge.toNode).name;
                graph[fromNode][toNode] = edge.weight;
                
            });

            const shortestPath = dijkstra(graph, startNode, endNode);
            if (shortestPath.path.length === 0) {
                res.status(404).send('Nessun percorso trovato.');
            } else {
                const insertQuery = 'INSERT INTO results (startNode, endNode, path, totalWeight) VALUES (?, ?, ?, ?)';
                db.query(insertQuery, [startNode, endNode, shortestPath.path.join(' -> '), shortestPath.totalWeight], (err) => {
                    if (err) {
                        console.error('Errore nel salvare il risultato:', err);
                        res.status(500).send('Errore nel salvare il risultato.');
                    } else {
                        res.json(shortestPath);
                    }
                });
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Errore nel calcolare il percorso.');
        });
});

router.get('/results', (req, res) => {
    const query = 'SELECT * FROM results ORDER BY timestamp DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Errore nel recuperare i risultati:', err);
            res.status(500).send('Errore nel recuperare i risultati.');
        } else {
            res.json(results);
        }
    });
});

function dijkstra(graph, startNode, endNode) {
    const distances = {};
    const prev = {};
    const queue = [];

    Object.keys(graph).forEach(node => {
        distances[node] = Infinity;
        prev[node] = null;
        queue.push(node);
    });
    distances[startNode] = 0;

    while (queue.length > 0) {
        queue.sort((a, b) => distances[a] - distances[b]);
        const currentNode = queue.shift();

        if (currentNode === endNode) {
            const path = [];
            let tempNode = endNode;
            while (tempNode) {
                path.unshift(tempNode);
                tempNode = prev[tempNode];
            }
            return { path, totalWeight: distances[endNode] };
        }

        Object.keys(graph[currentNode]).forEach(neighbor => {
            const alt = distances[currentNode] + graph[currentNode][neighbor];
            if (alt < distances[neighbor]) {
                distances[neighbor] = alt;
                prev[neighbor] = currentNode;
            }
        });
    }

    return { path: [], totalWeight: Infinity };
}

router.delete('/graph', (req, res) => {
    const deleteResults = 'DELETE FROM results';
    const deleteEdges = 'DELETE FROM edges';
    const deleteNodes = 'DELETE FROM nodes';

    // Esegui le query in sequenza
    db.query(deleteResults, (err) => {
        if (err) {
            console.error('Errore nell\'eliminare i risultati:', err);
            res.status(500).send('Errore nell\'eliminare i risultati.');
        } else {
            db.query(deleteEdges, (err) => {
                if (err) {
                    console.error('Errore nell\'eliminare gli archi:', err);
                    res.status(500).send('Errore nell\'eliminare gli archi.');
                } else {
                    db.query(deleteNodes, (err) => {
                        if (err) {
                            console.error('Errore nell\'eliminare i nodi:', err);
                            res.status(500).send('Errore nell\'eliminare i nodi.');
                        } else {
                            res.send('Grafo eliminato con successo.');
                        }
                    });
                }
            });
        }
    });
});

module.exports = router;
