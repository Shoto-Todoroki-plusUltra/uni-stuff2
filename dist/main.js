import { Network } from './network.js';
import { P2PNode } from './node.js';
import { Visualizer } from './visualizer.js';
import { RoutingController } from './routingController.js';
// DOM Elements
const startNodeInput = document.getElementById('startNode');
const endNodeInput = document.getElementById('endNode');
const initRouteButton = document.getElementById('initRouteButton');
const playPauseButton = document.getElementById('playPauseButton');
const resetButton = document.getElementById('resetButton');
const currentActionSpan = document.getElementById('currentAction');
const pathTakenSpan = document.getElementById('pathTaken');
const tryingNeighborSpan = document.getElementById('tryingNeighbor');
const filterTierSpan = document.getElementById('filterTier');
// Setup
const MAX_HOPS_BF = 3; // Max k for BF_Hk
const BF_SIZE = 60; // Bloom filter size (tune based on expected items)
const BF_HASHES = 2; // Number of hash functions
const network = new Network(MAX_HOPS_BF, BF_SIZE, BF_HASHES);
const visualizer = new Visualizer('networkCanvas', network);
const updateStatus = (s) => { currentActionSpan.textContent = s; };
const updatePath = (p) => { pathTakenSpan.textContent = p; };
const updateTrying = (n, t) => {
    tryingNeighborSpan.textContent = n;
    filterTierSpan.textContent = t;
};
const routingController = new RoutingController(network, visualizer, updateStatus, updatePath, updateTrying);
function setupDefaultNetwork() {
    network.nodes.clear(); // Clear existing nodes if any for reset
    // Define Nodes with positions
    const nodesData = [
        { id: 'A', x: 100, y: 100 }, { id: 'B', x: 250, y: 100 },
        { id: 'C', x: 100, y: 250 }, { id: 'D', x: 250, y: 250 },
        { id: 'E', x: 400, y: 180 }, { id: 'F', x: 550, y: 250 },
        { id: 'G', x: 400, y: 350 }, { id: 'H', x: 180, y: 400 },
    ];
    nodesData.forEach(nd => network.addNode(new P2PNode(nd.id, { x: nd.x, y: nd.y })));
    // Define Connections
    network.connectNodes('A', 'B');
    network.connectNodes('A', 'C');
    network.connectNodes('B', 'D');
    network.connectNodes('B', 'E');
    network.connectNodes('C', 'D');
    network.connectNodes('C', 'H');
    network.connectNodes('D', 'E');
    network.connectNodes('D', 'G');
    network.connectNodes('E', 'F');
    network.connectNodes('G', 'F');
    network.connectNodes('H', 'G');
    // Initialize Bloom Filters for the entire network
    network.initializeAllBloomFilters();
    routingController.reset(); // Also resets controller state
    visualizer.render();
    playPauseButton.disabled = true;
    updateStatus("Network Ready. Enter Start/End nodes and Initialize Route.");
}
// Event Listeners
initRouteButton.addEventListener('click', () => {
    const startId = startNodeInput.value.toUpperCase();
    const endId = endNodeInput.value.toUpperCase();
    if (routingController.initializeRoute(startId, endId)) {
        playPauseButton.disabled = false;
        playPauseButton.textContent = 'Play';
    }
    else {
        playPauseButton.disabled = true;
    }
});
playPauseButton.addEventListener('click', () => {
    routingController.playPause();
    playPauseButton.textContent = routingController.isPaused ? 'Play' : 'Pause';
});
resetButton.addEventListener('click', () => {
    setupDefaultNetwork(); // Re-create and re-initialize network
    // routingController.reset(); // Already called in setupDefaultNetwork
    playPauseButton.textContent = 'Play';
    // playPauseButton.disabled = true; // Will be enabled by successful init
});
// Initial Setup
setupDefaultNetwork();
