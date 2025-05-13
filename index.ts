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
    if(caches.length === 0){
        //Create a default cache
        console.log('No caches found, creating default cache')
        await Database.createCache("default", "Read", true, "none", "XZ", "http://localhost:3000")
    }
    caches = await Database.getAllCaches()
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

//Check if there are "dangling" paths in the nar_file directory (i.e paths that are not in the database)
const paths = await Database.getDirectAccess().query(`
    SELECT path, id FROM cache.hashes 
`)
for(const pathObj of paths.rows){
    if(!fs.existsSync(pathObj.path)){
        console.log(`Path ${pathObj.path} does not exist, removing from database`)
        //Delete the path from the database
        await Database.deletePath(pathObj.id)
        continue
    }

    //Check how big the file is
    const stats = fs.statSync(pathObj.path);
    const fileSizeInBytes = stats.size;
    if(fileSizeInBytes === 0){
        console.log(`Path ${pathObj.path} is empty, removing from database and unlinking`)
        //Delete the path from the database
        await Database.deletePath(pathObj.id)
        //Unlink the file
        fs.unlinkSync(pathObj.path)
    }

}
//Check if there are leftover parts in the nar_file directory
for(const cache of await Database.getAllCaches()){
    const cacheDir = `./nar_files/${cache.name}`
    if(!fs.existsSync(cacheDir)){
        console.log(`Cache directory ${cacheDir} to cleanup does not exist`)
        continue
    }
    const files = fs.readdirSync(cacheDir)
    for(const file of files){
        //Check if the file is a file that ends with a number instead of .xz or .zstd
        if(!file.endsWith('.xz') && !file.endsWith('.zstd')){
            console.log(`Part file ${file} found, removing`)
            fs.unlinkSync(`${cacheDir}/${file}`)
        }
    }
}


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