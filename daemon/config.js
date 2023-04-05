import { hostname } from 'node:os'

/**
 * @typedef {Object} Config
 * @property {URL} server
 * @property {string} token
 * @property {boolean} noFancySessions
 */

const defaultConfig = {
    hostname: hostname(),
}

const _loadConfig = () => {
    /** @type {Config} */
    const config = { ...defaultConfig };
    if (process.env.SERVER) {
        try {
            config.server = new URL(process.env.SERVER);
        } catch (e) {
            console.error('Invalid server URL');
            process.exit(1);
        }
        if (!config.server.protocol.startsWith('http')) {
            console.error('Invalid server protocol');
            process.exit(1);
        }
    } else {
        console.error('Required environment variable SERVER is not set');
        process.exit(1);
    }
    if (process.env.TOKEN) config.token = process.env.TOKEN;
    if (process.env.NO_FANCY_SESSIONS) config.noFancySessions = true;
    if(!config.token) {
        console.error('Required environment variable TOKEN is not set');
        process.exit(1);
    }
    return config;
}

let config;

const getConfig = () => {
    if (!config) config = _loadConfig();
    return config;
}

export default getConfig;

