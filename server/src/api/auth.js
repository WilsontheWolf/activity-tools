import { deviceKeys, deviceStore, masterKey } from "./mem.js";
import { randomBytes, randomUUID } from "node:crypto";

/**
 * @typedef {Object} Auth
 * @property {boolean} authenticated - Whether the user is authenticated
 * @property {'Master'|'Bearer'|undefined} type - The type of authentication
 * @property {string|undefined} device - The device id. Only present if type is 'Bearer'
 */


const authMiddleware = async (ctx, next) => {
    const auth = ctx.request.headers.authorization;
    if (!auth) {
        ctx.auth = { authenticated: false };
        return await next();
    }
    const [type, token] = auth.split(' ');
    if (type === 'Master') {
        if (!masterKey) {
            ctx.auth = { authenticated: false };
            ctx.status = 401;
            ctx.body = 'Master key not set';
            return;
        }
        if (token !== masterKey) {
            ctx.auth = { authenticated: false };
            ctx.status = 401;
            ctx.body = 'Invalid master key';
            return;
        }
        ctx.auth = {
            type: 'Master',
            authenticated: true,
        };
    }
    else if (type === 'Bearer') {
        if (deviceKeys.has(token)) {
            if(!deviceStore.has(deviceKeys.get(token))) {
                // Should never happen
                ctx.auth = { authenticated: false };
                deviceKeys.delete(token);
                ctx.status = 401;
                ctx.body = 'Invalid bearer token';
                return;
            }
            ctx.auth = {
                type: 'Bearer',
                authenticated: true,
                device: deviceKeys.get(token),
            };
        } else {
            ctx.auth = { authenticated: false };
            ctx.status = 401;
            ctx.body = 'Invalid bearer token';
            return;
        }
    }
    else {
        ctx.auth = { authenticated: false };
    }
    return await next();
}

/**
 * 
 * @param {Auth} auth - The type of authentication
 * @param {Object} perm - The permission required
 * @param {'Master'|'Bearer'|'Unauthenticated'} perm.type - The type of authentication required
 * @param {string?} perm.device - The device id. Only checked if type is 'Bearer'
 * @returns {boolean} Whether the user is allowed to access the resource
 */
const isAllowed = (auth, perm = {
    type: 'Master',
    device: undefined,
}) => {
    if (perm.type === 'Unauthenticated') {
        return true;
    }
    if (!auth.authenticated) {
        return false;
    }
    if (auth.type === 'Master') {
        return true;
    }
    if (perm.type === 'Master') {
        return false;
    }
    else if (perm.type === 'Bearer') {
        if (auth.type === 'Bearer') {
            if (!perm.device) {
                return true;
            }
            if (perm.device === auth.device) {
                return true;
            }
        }
    }
    return false;
};

const generateToken = () => {
    return randomBytes(32).toString('hex');
};

const clearTokens = (id) => {
    deviceKeys.filter(d => d === id).forEach((d, k) => deviceKeys.delete(k));
};

const newToken = (id) => {
    if(!deviceStore.has(id)) {
        return null;
    }
    clearTokens(id);
    const token = generateToken();
    deviceKeys.set(token, id);
    return token;
};

const newDevice = () => {
    let id = randomUUID();
    while (deviceStore.has(id)) {
        id = randomUUID();
    }
    return id;
};


export {
    authMiddleware,
    isAllowed,
    newToken,
    clearTokens,
    newDevice,
};