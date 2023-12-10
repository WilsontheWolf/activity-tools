import { EventEmitter } from "node:events";
import { OPCodes } from "./IPC.js";
import { createConnection } from "node:net";


class ProxyHandler extends EventEmitter {
    #working = {
        app: {
            full: '',
            op: undefined,
        },
        client: {
            full: '',
            op: undefined,
        }
    }

    /** @type {import('node:net').Socket} */
    #sock;

    /** @type {import('node:net').Socket} */
    #client;

    #up = true;

    #clientUp = false;

    #interval;

    #messageHolder = [];

    #path;


    constructor(sock, path) {
        super();
        this.#sock = sock;
        this.#sock.on('data', this.#message.bind(this));
        this.on('raw', this.#handleRaw.bind(this));
        this.on('client', this.#handleClient.bind(this));
        this.#sock.on('close', () => this.close());
        this.#path = path;

        this.#connectClient();
    }

    /**
     * @param {Buffer} buff
     */
    #message(buff, from = 'app') {
        let { op } = this.#working[from];
        let raw;

        if (this.#working[from].full === '') {
            op = this.#working[from].op = buff.readInt32LE(0);
            const len = buff.readInt32LE(4);
            raw = buff.subarray(8, len + 8);
        } else {
            raw = buff.toString();
        }

        try {
            const data = JSON.parse(this.#working[from].full + raw);
            if (from === 'app')
                this.emit('raw', { op, data });
            else
                this.emit('client', { op, data });
            this.#working[from].full = '';
            this.#working[from].op = undefined;
        }
        catch (err) {
            this.#working[from].full += raw;
        }
    }

    send(data, op = OPCodes.FRAME) {
        this.#sock.write(this.encode(op, data));
    }

    encode(op, data) {
        data = JSON.stringify(data);
        const len = Buffer.byteLength(data);
        const packet = Buffer.alloc(8 + len);
        packet.writeInt32LE(op, 0);
        packet.writeInt32LE(len, 4);
        packet.write(data, 8, len);

        return packet;
    }

    #handleRaw({ op, data }) {
        switch (op) {
            case OPCodes.HANDSHAKE:
                if (data.client_id) this.clientID = data.client_id;
                break;
            case OPCodes.FRAME:
                this.emit('message', data)
                break;
            case OPCodes.CLOSE:
                this.close()
                break;
            default:
                console.error('Unexpected OPCode', op, data);
                break;
        }
        this.rebroadcast({ op, data });
    }

    rebroadcast(data) {
        if (!this.#clientUp) return this.#messageHolder.push(data);
        this.#client.write(this.encode(data.op, data.data));
    }

    #connectClient() {
        this.#client = createConnection(this.#path, () => {
            this.#clientUp = true;
            this.#messageHolder.forEach(data => this.#client.write(this.encode(data.op, data.data)));
            this.#messageHolder = [];
        });
        this.#client.on('data', (d) => this.#message(d, 'client'));
        this.#client.on('close', () => this.close());
    }

    #handleClient({ op, data }) {
        this.send(data, op);
    }


    close() {
        console.log('Closing connection')
        if (this.#up) {
            this.send('', OPCodes.CLOSE);
            this.#sock.destroy();
            this.#up = false;
            clearInterval(this.#interval);
            this.emit('close');
        }
        if (this.#clientUp) {
            this.#client.destroy();
            this.#clientUp = false;
        }
    }

}

export default ProxyHandler;