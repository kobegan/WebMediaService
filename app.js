const Koa = require('koa');
const webmediaRouter = require('./routes/router');
const loggerAsync = require('./middleware/logger-async');
const errorHandler = require('./middleware/error-handler');
const bodyParser = require('koa-bodyparser');
const logger = require('koa-logger');
const views = require('koa-views');
const static = require('koa-static');
const Router = require('koa-router');

const https = require('https');
const fs = require("fs");

const privateKey  = fs.readFileSync('./sslfiles/private.pem', 'utf8');
const certificate = fs.readFileSync('./sslfiles/file.crt', 'utf8');
const credentials = {key: privateKey, cert: certificate};

const app = new Koa();

app.use(errorHandler());

app.use(logger());

app.use(views(__dirname + '/views',{ extension: 'html' }));
app.use(static(__dirname + '/public/dist'));

app.use(loggerAsync());
app.use(bodyParser());

// 装载所有子路由
let router = new Router();

router.get('/', async (ctx, next) => {
    await ctx.render('index');
});

router.use('/webmedia', webmediaRouter.routes(), webmediaRouter.allowedMethods());

app.use(router.routes()).use(router.allowedMethods());

app.on('error', function(err, ctx){
    console.log('server error', err, ctx);
    ctx.status = 500;
});

https.createServer(credentials,app.callback()).listen(3003);
console.log('Web Media Service https server listening on port 3003');

app.listen(3002);

console.log('Web Media Service http server listening on port 3002');
