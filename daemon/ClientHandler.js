import { EventEmitter } from "node:events";
import { OPCodes } from "./IPC.js";

const defaultDispatch = {
    v: 1,
    config: {
        cdn_host: 'cdn.discordapp.com',
        api_endpoint: '//discord.com/api',
        environment: 'production'
    }
}


class ClientHandler extends EventEmitter {
    #working = {
        full: '',
        op: undefined,
    };

    #dispatchDetails = defaultDispatch;

    /** @type {import('node:net').Socket} */
    #sock;

    #up = true;

    #interval;

    #lastPong = Date.now();

    constructor(sock, dispatchDetails) {
        super();
        this.#sock = sock;
        this.#sock.on('data', this.#message.bind(this));
        if (dispatchDetails !== undefined) this.#dispatchDetails = dispatchDetails;
        this.on('raw', this.#handleRaw.bind(this));
        setInterval(() => {
            if (this.#up) {
                // if(Date.now() - this.#lastPong > 4000) {
                //     this.close();
                // }
                this.send(Date.now().toString(), OPCodes.PING);
            }
        }, 2000);
        this.#sock.on('close', () => this.close());
    }

    /**
     * @param {Buffer} buff
     */
    #message(buff) {
        let { op } = this.#working;
        let raw;

        if (this.#working.full === '') {
            op = this.#working.op = buff.readInt32LE(0);
            const len = buff.readInt32LE(4);
            raw = buff.subarray(8, len + 8);
        } else {
            raw = buff.toString();
        }

        try {
            const data = JSON.parse(this.#working.full + raw);
            this.emit('raw', { op, data });
            this.#working.full = '';
            this.#working.op = undefined;
        }
        catch (err) {
            this.#working.full += raw;
        }
    }

    send(data, op = OPCodes.FRAME) {
        this.#sock.write(this.encode(op, data));
    }

    sendCmd(cmd, data, { evt = undefined, nonce = undefined }) {
        this.send({
            cmd,
            data,
            evt,
            nonce,
        });
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
                if (this.#dispatchDetails) {
                    setTimeout(() => {
                        this.sendCmd('DISPATCH', this.#dispatchDetails, { evt: 'READY' });
                        this.emit('ready');
                    }, 1000)
                }
                break;
            case OPCodes.FRAME:
                this.emit('message', data)
                break;
            case OPCodes.CLOSE:
                this.close()
                break;
            case OPCodes.PONG:
                this.#lastPong = Date.now();
                break;
            default:
                console.error('Unexpected OPCode', op, data);
                break;
        }
    }

    close() {
        console.log('Closing connection')
        if (!this.#up) return;
        this.send('', OPCodes.CLOSE);
        this.#sock.destroy();
        this.#up = false;
        clearInterval(this.#interval);
        this.emit('close');
    }

}

export default ClientHandler;