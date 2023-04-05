import Router from "@koa/router";
import { deviceStore, getDevice } from "./mem.js";
import { clearTokens, isAllowed, newDevice, newToken } from "./auth.js";
import { isStatus } from "../../../shared/status.mjs";
import APIActivity from "./APIActivity.js";
// import { PassThrough } from 'node:stream';

const router = new Router();

router.get('/devices', async (ctx, next) => {
    ctx.body = Array.from(deviceStore.keys()).map(getDevice);
});

router.post('/devices', async (ctx, next) => {
    if (!isAllowed(ctx.auth, { type: 'Master' })) {
        ctx.status = 403;
        ctx.body = 'Forbidden';
        return;
    };

    const { name } = ctx.request.body;

    // UUID
    const id = newDevice();

    deviceStore.set(id, {
        id,
        status: 'offline',
        lastSeen: new Date(),
        created: new Date(),
        activities: [],
        name,
    });

    ctx.body = getDevice(id);
});

router.patch('/devices/:id', async (ctx, next) => {
    let { id } = ctx.params;
    if (id === '@me' && ctx.auth.device) id = ctx.auth.device;

    if (!isAllowed(ctx.auth, { type: 'Bearer', device: id })) {
        ctx.status = 403;
        ctx.body = 'Forbidden';
        return;
    };

    if (!deviceStore.has(id)) {
        ctx.status = 404;
        ctx.body = 'Device not found';
        return;
    }

    const { name } = ctx.request.body;

    const device = getDevice(id);

    if (name) device.name = name;

    deviceStore.set(id, device);

    ctx.body = device;
});


router.get('/devices/:id/token', async (ctx, next) => {
    let { id } = ctx.params;

    if (id === '@me' && ctx.auth.device) id = ctx.auth.device;

    if (!isAllowed(ctx.auth, { type: 'Master', device: id })) {
        ctx.status = 403;
        ctx.body = 'Forbidden';
        return;
    };

    if (!deviceStore.has(id)) {
        ctx.status = 404;
        ctx.body = 'Device not found';
        return;
    }

    const token = newToken(id);

    ctx.body = token;
});

router.get('/devices/:id', async (ctx, next) => {
    let { id } = ctx.params;
    if (id === '@me' && ctx.auth.device) id = ctx.auth.device;
    if (!deviceStore.has(id)) {
        ctx.status = 404;
        ctx.body = 'Device not found';
        return;
    }
    ctx.body = getDevice(id);
});

router.delete('/devices/:id', async (ctx, next) => {
    let { id } = ctx.params;
    if (id === '@me' && ctx.auth.device) id = ctx.auth.device;

    if (!isAllowed(ctx.auth, { type: 'Master' })) {
        ctx.status = 403;
        ctx.body = 'Forbidden';
        return;
    };

    if (!deviceStore.has(id)) {
        ctx.status = 404;
        ctx.body = 'Device not found';
        return;
    }

    deviceStore.delete(id);
    clearTokens(id);

    ctx.status = 204;
});

router.post('/devices/:id/heartbeat', async (ctx, next) => {
    let { id } = ctx.params;
    if (id === '@me' && ctx.auth.device) id = ctx.auth.device;

    if (!isAllowed(ctx.auth, { type: 'Bearer', device: id })) {
        ctx.status = 403;
        ctx.body = 'Forbidden';
        return;
    };

    if (!deviceStore.has(id)) {
        ctx.status = 404;
        ctx.body = 'Device not found';
        return;
    }

    const device = getDevice(id);
    const body = ctx.request.body;

    if (body.status) {
        if (isStatus(body.status)) {
            device.status = body.status;
        } else {
            ctx.status = 400;
            ctx.body = 'Invalid status';
            return;
        }
    }

    if (body.data) {
        const data = body.data;
        if (data.activities) {
            let activities = data.full ? {} : Object.fromEntries(device.activities.map(a => [a.id, a]));
            device.activities = Object.entries(data.activities).forEach(([id, activity]) => {
                if(!id) return;
                if (activity === null) {
                    delete activities[id];
                } else {
                    const act = APIActivity.tryActivity(activity, id, Date.now());
                    if (act) {
                        activities[id] = act;
                    }
                }
            });
            device.activities = Object.values(activities);
        } else if (data.activities === null) {
            device.data.activities = [];
        }
    }

    device.lastSeen = new Date();

    deviceStore.set(id, device);

    ctx.body = device;
});



router.get('/debug/delete-all', async (ctx, next) => {
    if (!isAllowed(ctx.auth, { type: 'Master' })) {
        ctx.status = 403;
        ctx.body = 'Forbidden';
        return;
    };

    if (process.env.NODE_ENV !== 'development') {
        ctx.status = 403;
        ctx.body = 'Forbidden';
        return;
    }

    deviceStore.clear();

    ctx.status = 204;
});
// const streams = new Set();

// router.get('/stream', async (ctx, next) => {
//     ctx.request.socket.setTimeout(0);
//     ctx.req.socket.setNoDelay(true);
//     ctx.req.socket.setKeepAlive(true);
//     ctx.set({
//         "Content-Type": "text/event-stream",
//         "Cache-Control": "no-cache",
//         "Connection": "keep-alive",
//     });

//     const stream = new PassThrough();

//     const id = ctx.request.socket.remoteAddress + ':' + Date.now();
//     streams.add(stream);
//     ctx.status = 200;
//     ctx.body = stream;

//     stream.on("close", () => {
//         streams.delete(id);
//     });
//     stream.write(': ok\n\n');
// });

// activityCache.onUpdate = (id, activity) => {
//     streams.forEach((stream) => {
//         stream.write(`data: ${JSON.stringify({ id, activity })}

// `);
//     });
// };

// setInterval(() => {
//     streams.forEach((stream) => {
//         stream.write(': ping\n\n');
//     });
// }, 1000 * 10);


export default router;