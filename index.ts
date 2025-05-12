import type {NextFunction, Request, Response} from 'express'
import bodyParser from "express";
import fs from "fs";
import raw from 'express'
import db from "./utils/db";
import createRouter, {router} from "express-file-routing"
import type {cache} from "./utils/types.d/dbTypes.ts";
import {makeApiKey} from "./utils/apiKeys.ts";
const app = require('express')()
const pino = require('pino-http')()


let parseJson = bodyParser.json()

type configObject = {
    "server" : {
        "database" : {
            "dbHost":string,
            "dbPort":number,
            "dbUser":string,
            "dbPassword":string,
        }
        key: string,
        retention: 4
    }
}

//app.use(pino)
// Middleware to handle all routes
const Database = new db();
await Database.getAllCaches().then(async (caches:Array<cache>)=>{
    for (const cache of caches) {
        if(cache.allowedKeys.length === 0){
            const cacheKey = makeApiKey(cache.name)
            console.log(`Initial Key for cache ${cache.name}: ${cacheKey}`)
            try{
                await Database.appendApiKey(cache.id, cacheKey)
            }
            catch(e) {
                console.error('Error whilst appening:', e)
                return -1
            }
        }
        //Show the public signing key for this cache
        console.log(`Public signing keys for cache ${cache.name}: ${cache.publicSigningKeys}`)
    }
})
app.use(raw())

await createRouter(app, {
    additionalMethods: [ "ws" ]
})

app.use((req:Request, res:Response) => {
    //req.log.info(req.url)
    console.log('CATCHALL', req.url)
    console.log('CATCHALL method', req.method)
    console.log('CATCHALL headers', req.headers)
    if(req.body){
        //console.log('Req body', req.body)
        //fs.writeFileSync(__dirname + "/req.json", JSON.stringify(req.body), "utf8")
    }
    res.status(200).send('OK');
});

app.listen(3000)