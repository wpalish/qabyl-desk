import {createServer} from './core/server.js';
const port=Number(process.env.PORT||8859),host=process.env.HOST||'127.0.0.1',origin=process.env.ORIGIN||`http://${host}:${port}`;
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT1024–65535 required');
if(!process.env.ADMIN_USERNAME||!process.env.ADMIN_PASSWORD)throw Error('Set ADMIN_USERNAME and ADMIN_PASSWORD14–200characters before first start;never commit credentials.');
const app=createServer({database:process.env.DB_PATH||'.data/qabyl.sqlite',origin,admin:{username:process.env.ADMIN_USERNAME,password:process.env.ADMIN_PASSWORD}});
app.server.listen(port,host,()=>console.log(`QabylDesk ${origin}`));
