import { P2PNode, NodeId, NodePosition } from './node.js';
import { Network } from './network.js';

export interface DataPacket {
    currentPosition: NodePosition;
    targetPosition: NodePosition;
    isMoving: boolean;
    progress: number;
    color: string;
}

export class Visualizer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private network: Network;
    private nodeRadius = 20;
    private packetRadius = 8;

    constructor(canvasId: string, network: Network) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.network = network;
        this.canvas.width = 800;
        this.canvas.height = 500;
    }

    private drawNode(node: P2PNode, color: string = 'lightblue', textColor: string = 'black'): void {
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

    private drawEdge(node1: P2PNode, node2: P2PNode, color: string = 'lightgrey'): void {
        this.ctx.beginPath();
        this.ctx.moveTo(node1.position.x, node1.position.y);
        this.ctx.lineTo(node2.position.x, node2.position.y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    private drawDataPacket(packet: DataPacket | null): void {
        if (!packet || !packet.isMoving) return;
        const currentX = packet.currentPosition.x + (packet.targetPosition.x - packet.currentPosition.x) * packet.progress;
        const currentY = packet.currentPosition.y + (packet.targetPosition.y - packet.currentPosition.y) * packet.progress;

        this.ctx.beginPath();
        this.ctx.arc(currentX, currentY, this.packetRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = packet.color;
        this.ctx.fill();
        this.ctx.strokeStyle = 'black';
        this.ctx.stroke();
    }


    render(
        pathTaken: NodeId[] = [],
        currentNodeId?: NodeId,
        destinationNodeId?: NodeId,
        packet?: DataPacket | null
    ): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.network.nodes.forEach(node => {
            node.neighbors.forEach(neighborId => {
                const neighborNode = this.network.getNode(neighborId);
                if (neighborNode && node.id < neighborId) {
                    const isPathEdge = pathTaken.includes(node.id) && pathTaken.includes(neighborId) && Math.abs(pathTaken.indexOf(node.id) - pathTaken.indexOf(neighborId)) === 1;
                    this.drawEdge(node, neighborNode, isPathEdge ? 'orange' : 'lightgrey');
                }
            });
        });

        this.network.nodes.forEach(node => {
            let color = 'lightblue';
            if (node.id === currentNodeId) color = 'lightgreen';
            if (pathTaken.includes(node.id)) color = 'orange';
            if (node.id === destinationNodeId) color = 'pink';
            this.drawNode(node, color);
        });

        if (packet) this.drawDataPacket(packet);
    }
}
