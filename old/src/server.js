import Koa from 'koa';
import Router from "@koa/router";
import activityCache from './index.js';
import { resolveStatic } from './helpers.js';
import { PassThrough } from 'node:stream';
// import bodyParser from 'koa-bodyparser';

const router = new Router();

router.get('/activities', async (ctx, next) => {
    let res = {};
    activityCache.forEach((v, k) => {
        res[k] = v;
    });
    ctx.body = res;
});

const streams = new Set();

router.get('/stream', async (ctx, next) => {
    ctx.request.socket.setTimeout(0);
    ctx.req.socket.setNoDelay(true);
    ctx.req.socket.setKeepAlive(true);
    ctx.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    });

    const stream = new PassThrough();

    const id = ctx.request.socket.remoteAddress + ':' + Date.now();
    streams.add(stream);
    ctx.status = 200;
    ctx.body = stream;

    stream.on("close", () => {
        streams.delete(id);
    });
    stream.write(': ok\n\n');
});

activityCache.onUpdate = (id, activity) => {
    streams.forEach((stream) => {
        stream.write(`data: ${JSON.stringify({ id, activity })}

`);
    });
};

setInterval(() => {
    streams.forEach((stream) => {
        stream.write(': ping\n\n');
    });
}, 1000 * 10);
    // router.get('/shared/:path*', async (ctx, next) => {
    //     const path = normalizePath('/' + (ctx.params.path || ''));
    //     const file = joinPath('./src/shared', path);

    //     try {
    //         const f = await readFile(file, 'utf8');
    //         ctx.body = f;

    //     } catch (e) {
    //         ctx.status = 404;
    //     }
    // });




    const app = new Koa();

    const port = process.env.PORT || 3000;

    app
        .use(router.routes())
        .use(router.allowedMethods())
        .use(async (ctx, next) => {
            if (ctx.status === 404 && !ctx.body) {
                await resolveStatic(ctx.request.url).then(({ data, mime }) => {
                    if (data) {
                        ctx.body = data;
                        ctx.type = mime;
                        ctx.status = 200;
                    }
                });
            }
            await next();
        })
        .listen(port);

    console.log(`Server running on port ${port}`);