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
const pruneButton = document.getElementById('pruneButton'); // New button
const currentActionSpan = document.getElementById('currentAction');
const pathTakenSpan = document.getElementById('pathTaken');
const tryingNeighborSpan = document.getElementById('tryingNeighbor');
const filterTierSpan = document.getElementById('filterTier');
// Setup
const MAX_HOPS_BF = 3;
const BF_SIZE = 60;
const BF_HASHES = 2;
const STALE_HINT_THRESHOLD_MS = 30000; // 30 seconds for a hint to become stale for demo
const network = new Network(MAX_HOPS_BF, BF_SIZE, BF_HASHES);
network.STALE_THRESHOLD_MS = STALE_HINT_THRESHOLD_MS; // Set it on the network instance
const visualizer = new Visualizer('networkCanvas', network);
const updateStatus = (s) => { currentActionSpan.textContent = s; };
const updatePath = (p) => { pathTakenSpan.textContent = p; };
const updateTrying = (n, t) => {
    tryingNeighborSpan.textContent = n;
    filterTierSpan.textContent = t;
};
const routingController = new RoutingController(network, visualizer, updateStatus, updatePath, updateTrying);
function setupDefaultNetwork() {
    network.nodes.clear();
    const nodesData = [
        { id: 'A', x: 100, y: 100 }, { id: 'B', x: 250, y: 100 },
        { id: 'C', x: 100, y: 250 }, { id: 'D', x: 250, y: 250 },
        { id: 'E', x: 400, y: 180 }, { id: 'F', x: 550, y: 250 },
        { id: 'G', x: 400, y: 350 }, { id: 'H', x: 180, y: 400 },
    ];
    nodesData.forEach(nd => network.addNode(new P2PNode(nd.id, { x: nd.x, y: nd.y })));
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
    network.initializeNetworkInfo(); // Changed method name
    routingController.reset();
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
    setupDefaultNetwork();
    playPauseButton.textContent = 'Play';
});
pruneButton.addEventListener('click', () => {
    updateStatus("Pruning stale hints and rebuilding network info...");
    network.pruneAllNodes(network.STALE_THRESHOLD_MS); // Use threshold from network
    // After pruning, current routes are invalid, so reset routing controller
    routingController.reset();
    visualizer.render(); // Re-render the network state
    playPauseButton.disabled = true; // Require re-initialization of route
    playPauseButton.textContent = 'Play';
    updateStatus("Pruning complete. Network info rebuilt. Initialize a new route.");
});
// Initial Setup
setupDefaultNetwork();
