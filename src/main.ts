import { Network } from './network.js';
import { P2PNode } from './node.js';
import { Visualizer } from './visualizer.js';
import { RoutingController } from './routingController.js';

const startNodeInput = document.getElementById('startNode') as HTMLInputElement;
const endNodeInput = document.getElementById('endNode') as HTMLInputElement;
const initRouteButton = document.getElementById('initRouteButton') as HTMLButtonElement;
const playPauseButton = document.getElementById('playPauseButton') as HTMLButtonElement;
const resetButton = document.getElementById('resetButton') as HTMLButtonElement;

const currentActionSpan = document.getElementById('currentAction') as HTMLSpanElement;
const pathTakenSpan = document.getElementById('pathTaken') as HTMLSpanElement;
const tryingNeighborSpan = document.getElementById('tryingNeighbor') as HTMLSpanElement;
const filterTierSpan = document.getElementById('filterTier') as HTMLSpanElement;


const MAX_HOPS_BF = 3;
const BF_SIZE = 60;
const BF_HASHES = 2;

const network = new Network(MAX_HOPS_BF, BF_SIZE, BF_HASHES);
const visualizer = new Visualizer('networkCanvas', network);

const updateStatus = (s: string) => { currentActionSpan.textContent = s; };
const updatePath = (p: string) => { pathTakenSpan.textContent = p; };
const updateTrying = (n: string, t: string) => {
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
        { id: 'G', x: 400, y: 350 }, { id: 'H', x: 180, y: 400},
    ];
    nodesData.forEach(nd => network.addNode(new P2PNode(nd.id, { x: nd.x, y: nd.y })));

    network.connectNodes('A', 'B'); network.connectNodes('A', 'C');
    network.connectNodes('B', 'D'); network.connectNodes('B', 'E');
    network.connectNodes('C', 'D'); network.connectNodes('C', 'H');
    network.connectNodes('D', 'E'); network.connectNodes('D', 'G');
    network.connectNodes('E', 'F');
    network.connectNodes('G', 'F'); network.connectNodes('H', 'G');


    network.initializeAllBloomFilters();
    routingController.reset();
    visualizer.render();
    playPauseButton.disabled = true;
    updateStatus("Network Ready. Enter Start/End nodes and Initialize Route.");
}

initRouteButton.addEventListener('click', () => {
    const startId = startNodeInput.value.toUpperCase();
    const endId = endNodeInput.value.toUpperCase();
    if (routingController.initializeRoute(startId, endId)) {
        playPauseButton.disabled = false;
        playPauseButton.textContent = 'Play';
    } else {
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

setupDefaultNetwork();
