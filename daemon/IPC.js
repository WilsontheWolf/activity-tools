import { createServer } from 'node:net';
import { join as joinPath } from 'node:path'

/** @type {Set<import('node:net').Socket>} */
const sockets = new Set();

const killSocket = (sock) => {
    sock.destroy();
    sock.unref();
    sockets.delete(sock);
};

const OPCodes = {
    HANDSHAKE: 0,
    FRAME: 1,
    CLOSE: 2,
    PING: 3,
    PONG: 4,
};

const path = (id) => {
    if (process.platform === 'win32') { // TODO: test this
        return `\\\\?\\pipe\\discord-ipc-${id}`;
    }

    const { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP, IPC_OVERRIDE_DIR } = process.env;
    const prefix = IPC_OVERRIDE_DIR || XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp';
    return joinPath(prefix, `discord-ipc-${id}`);

}

/** @type {import('node:net').Server?} */
let server;
let id = 0;

const getServer = () => {
    if (server) {
        return server;
    }
    server = createServer((sock) => {
        sockets.add(sock);
        sock.on('close', () => {
            killSocket(sock);
        });
    } );

    return server;
}

const listen = () => {
    return new Promise((resolve, reject) => {
        const server = getServer();
        server.listen(path(id), () => {
            resolve(server);
        });
    });

};

const makeIPC = () => {
    return new Promise((resolve, reject) => {
        const server = getServer();
        server.on('error', (err) => {
            console.error(err);
            if (err.code === 'EADDRINUSE') {
                id++;
                resolve(listen(id));
            }
        });
        return listen(id);
    });
};

const cleanup = () => {
    console.log('exiting')
    if (server && server.listening) {
        server.close();
        server.unref();
        server = null;
    } if (sockets.size)
        sockets.forEach(killSocket);
};

const cleanupAndDie = () => {
    cleanup();
    process.exit(0);
};

process.on('exit', cleanupAndDie);

process.on('SIGINT', cleanupAndDie);

process.on('SIGTERM', cleanupAndDie);

process.on('uncaughtException', (err) => {
    console.error(err);
    cleanupAndDie();
});

process.on('unhandledRejection', (err) => {
    console.error(err);
    cleanupAndDie();
});

export {
    OPCodes,
    makeIPC,
    path,
    getServer,
}