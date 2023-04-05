import Koa from 'koa';
import router from './api/api.js';
import bodyParser from 'koa-bodyparser';
import { authMiddleware } from './api/auth.js';

const app = new Koa();

const port = process.env.PORT || 3000;

app
    .use(bodyParser())
    .use(authMiddleware)
    .use(router.routes())
    .use(router.allowedMethods())
    // .use(async (ctx, next) => {
    //     if (ctx.status === 404 && !ctx.body) {
    //         await resolveStatic(ctx.request.url).then(({ data, mime }) => {
    //             if (data) {
    //                 ctx.body = data;
    //                 ctx.type = mime;
    //                 ctx.status = 200;
    //             }
    //         });
    //     }
    //     await next();
    // })
    .listen(port);

console.log(`Server running on port ${port}`);