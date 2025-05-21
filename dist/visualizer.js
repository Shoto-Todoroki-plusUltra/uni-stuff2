export class Visualizer {
    constructor(canvasId, network) {
        this.nodeRadius = 20;
        this.packetRadius = 8;
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.network = network;
        this.canvas.width = 800;
        this.canvas.height = 500;
    }
    drawNode(node, color = 'lightblue', textColor = 'black') {
        this.ctx.beginPath();
        this.ctx.arc(node.position.x, node.position.y, this.nodeRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = 'grey';
        this.ctx.stroke();
        this.ctx.fillStyle = textColor;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(node.id, node.position.x, node.position.y);
    }
    drawEdge(node1, node2, color = 'lightgrey') {
        this.ctx.beginPath();
        this.ctx.moveTo(node1.position.x, node1.position.y);
        this.ctx.lineTo(node2.position.x, node2.position.y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
    drawDataPacket(packet) {
        if (!packet || !packet.isMoving)
            return;
        const currentX = packet.currentPosition.x + (packet.targetPosition.x - packet.currentPosition.x) * packet.progress;
        const currentY = packet.currentPosition.y + (packet.targetPosition.y - packet.currentPosition.y) * packet.progress;
        this.ctx.beginPath();
        this.ctx.arc(currentX, currentY, this.packetRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = packet.color;
        this.ctx.fill();
        this.ctx.strokeStyle = 'black';
        this.ctx.stroke();
    }
    render(pathTaken = [], currentNodeId, destinationNodeId, packet) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Draw edges first
        this.network.nodes.forEach(node => {
            node.neighbors.forEach(neighborId => {
                const neighborNode = this.network.getNode(neighborId);
                if (neighborNode && node.id < neighborId) { // Draw each edge once
                    const isPathEdge = pathTaken.includes(node.id) && pathTaken.includes(neighborId) &&
                        Math.abs(pathTaken.indexOf(node.id) - pathTaken.indexOf(neighborId)) === 1;
                    this.drawEdge(node, neighborNode, isPathEdge ? 'orange' : 'lightgrey');
                }
            });
        });
        // Draw nodes
        this.network.nodes.forEach(node => {
            let color = 'lightblue';
            if (node.id === currentNodeId)
                color = 'lightgreen';
            if (pathTaken.includes(node.id))
                color = 'orange';
            if (node.id === destinationNodeId)
                color = 'pink';
            this.drawNode(node, color);
        });
        // Draw packet
        if (packet) {
            this.drawDataPacket(packet);
        }
    }
}
