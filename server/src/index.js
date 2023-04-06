import Koa from 'koa';
import router from './api/api.js';
import bodyParser from 'koa-bodyparser';
import { authMiddleware } from './api/auth.js';

const app = new Koa();

const port = process.env.PORT || 3000;

app
    .use(bodyParser())
    .use(authMiddleware)
    .use(async (ctx, next) => { // CORS
        ctx.set('Access-Control-Allow-Origin', '*');
        ctx.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (ctx.method === 'OPTIONS') {
            ctx.status = 204;
            return;
        }
        await next();
    })
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(port);

console.log(`Server running on port ${port}`);