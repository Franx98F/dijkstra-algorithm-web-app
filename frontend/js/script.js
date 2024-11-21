
document.addEventListener('DOMContentLoaded', () => {
    function loadNodes() {
        axios.get('/api/nodes')
            .then(response => {
                const nodes = response.data;
                const nodeSelects = [
                    document.getElementById('fromNode'),
                    document.getElementById('toNode'),
                    document.getElementById('startNode'),
                    document.getElementById('endNode')
                ];
                nodeSelects.forEach(select => {
                    select.innerHTML = '<option value="">Seleziona Nodo</option>';
                    nodes.forEach(node => {
                        const option = document.createElement('option');
                        option.value = node.name;
                        option.textContent = node.name;
                        select.appendChild(option);
                    });
                });
            })
            .catch(err => console.error('Errore nel caricare i nodi:', err));
    }

    function loadAndDrawGraph() {
        Promise.all([
            axios.get('/api/nodes'),
            axios.get('/api/edges')
        ]).then(([nodesRes, edgesRes]) => {
            const nodes = nodesRes.data;
            const edges = edgesRes.data;

            drawGraph(nodes, edges);
        }).catch(err => console.error('Errore nel caricare il grafo:', err));
    }

    function drawGraph(nodes, edges) {
        const nodeById = {};
        nodes.forEach(node => {
            nodeById[node.id] = { id: node.id, name: node.name };
        });

        const graphNodes = Object.values(nodeById);

        const links = edges.map(edge => ({
            source: nodeById[edge.fromNode],
            target: nodeById[edge.toNode],
            weight: edge.weight
        }));

        const svg = d3.select('#graph').html('').append('svg')
            .attr('width', '100%')
            .attr('height', '500');

        const width = document.getElementById('graph').clientWidth;
        const height = 500;

        const simulation = d3.forceSimulation(graphNodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody())
            .force('center', d3.forceCenter(width / 2, height / 2));

        const link = svg.append('g')
            .attr('stroke', '#999')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke-width', d => Math.sqrt(d.weight));

        const node = svg.append('g')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .selectAll('circle')
            .data(graphNodes)
            .enter().append('circle')
            .attr('r', 10)
            .attr('fill', '#69b3a2')
            .call(drag(simulation));

        const text = svg.append('g')
            .selectAll('text')
            .data(graphNodes)
            .enter().append('text')
            .text(d => d.name)
            .attr('x', 15)
            .attr('y', 5);

        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            text
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        function drag(simulation) {
            function dragstarted(event) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }

            function dragged(event) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }

            function dragended(event) {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }

            return d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended);
        }
    }

    function highlightPath(path) {
        d3.selectAll('line').attr('stroke', '#999');
        for (let i = 0; i < path.length - 1; i++) {
            d3.selectAll('line')
                .filter(d => (d.source.name === path[i] && d.target.name === path[i + 1]))
                .attr('stroke', 'red');
        }
    }

    function loadResults() {
        axios.get('/api/results')
            .then(response => {
                const results = response.data;
                const resultsTableBody = document.querySelector('#resultsTable tbody');
                resultsTableBody.innerHTML = ''; 

                results.forEach(result => {
                    const row = document.createElement('tr');

                    const dateCell = document.createElement('td');
                    dateCell.textContent = new Date(result.timestamp).toLocaleString();
                    row.appendChild(dateCell);

                    const startNodeCell = document.createElement('td');
                    startNodeCell.textContent = result.startNode;
                    row.appendChild(startNodeCell);

                    const endNodeCell = document.createElement('td');
                    endNodeCell.textContent = result.endNode;
                    row.appendChild(endNodeCell);

                    const pathCell = document.createElement('td');
                    pathCell.textContent = result.path;
                    row.appendChild(pathCell);

                    const totalWeightCell = document.createElement('td');
                    totalWeightCell.textContent = result.totalWeight;
                    row.appendChild(totalWeightCell);

                    resultsTableBody.appendChild(row);
                });
            })
            .catch(err => console.error('Errore nel caricare i risultati:', err));
    }

    document.getElementById('addNodeBtn').addEventListener('click', () => {
        const nodeName = document.getElementById('nodeName').value.trim();
        if (!nodeName) {
            alert('Per favore, inserisci un nome per il nodo.');
            return;
        }
        axios.post('/api/nodes', { name: nodeName })
            .then(() => {
                alert('Nodo aggiunto con successo.');
                document.getElementById('nodeName').value = '';
                loadNodes();
                loadAndDrawGraph();
            })
            .catch(err => {
                console.error('Errore nell\'aggiungere il nodo:', err);
                alert('Errore nell\'aggiungere il nodo.');
            });
    });

    document.getElementById('addEdgeBtn').addEventListener('click', () => {
        const fromNode = document.getElementById('fromNode').value;
        const toNode = document.getElementById('toNode').value;
        const weight = parseInt(document.getElementById('weight').value, 10);
        if (!fromNode || !toNode || isNaN(weight)) {
            alert('Per favore, compila tutti i campi per aggiungere un arco.');
            return;
        }
        axios.post('/api/edges', { fromNode, toNode, weight })
            .then(() => {
                alert('Arco aggiunto con successo.');
                document.getElementById('weight').value = '';
                loadAndDrawGraph();
            })
            .catch(err => {
                console.error('Errore nell\'aggiungere l\'arco:', err);
                alert('Errore nell\'aggiungere l\'arco.');
            });
    });

    document.getElementById('calculateBtn').addEventListener('click', () => {
        const startNode = document.getElementById('startNode').value;
        const endNode = document.getElementById('endNode').value;
        if (!startNode || !endNode) {
            alert('Per favore, seleziona sia il nodo iniziale che il nodo finale.');
            return;
        }
        axios.post('/api/dijkstra', { startNode, endNode })
            .then(response => {
                const result = response.data;
                document.getElementById('result').innerText = `Percorso: ${result.path.join(' -> ')}\nDistanza Totale: ${result.totalWeight}`;
                highlightPath(result.path);
                loadResults(); 
            })
            .catch(err => {
                console.error('Errore nel calcolare il percorso:', err);
                alert('Errore nel calcolare il percorso.');
            });
    });

    document.getElementById('deleteGraphBtn').addEventListener('click', () => {
        if (confirm('ATTENZIONE: Questa operazione eliminerà tutti i nodi, gli archi e i risultati salvati. Vuoi procedere?')) {
            axios.delete('/api/graph')
                .then(() => {
                    alert('Grafo eliminato con successo.');
                    loadNodes();
                    loadAndDrawGraph();
                    loadResults();
                })
                .catch(err => {
                    console.error('Errore nell\'eliminare il grafo:', err);
                    alert('Errore nell\'eliminare il grafo.');
                });
        }
    });

    loadNodes();
    loadAndDrawGraph();
    loadResults();
});
