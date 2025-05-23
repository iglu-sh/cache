import type {NextFunction, Request, Response} from 'express'
import bodyParser from "express";
import fs from "fs";
import raw from 'express'
import db from "./utils/db";
import createRouter, {router} from "express-file-routing"
import type {cache, cacheWithKeys} from "./utils/types.d/dbTypes.ts";
import {makeApiKey} from "./utils/apiKeys.ts";
import 'dotenv/config'
import {migrate} from "./utils/migrations.ts";
const app = require('express')()
const pino = require('pino-http')()

let envs = [
    "CACHE_ROOT_DOMAIN",
    "CACHE_FILESYSTEM_DIR",
    "CACHE_MAX_GB",
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_HOST",
    "POSTGRES_PASSWORD",
    "POSTGRES_PORT",
    "LOG_LEVEL"
];

envs.forEach(env => {
  if(!process.env[env]){
    console.error('No ' + env + ' set, please set it in the .env file or your environment')
    process.exit(1)
  }
})

// Print config
console.log("----------CONFIG----------")
console.log("Database Host:\t" + process.env.POSTGRES_HOST)
console.log("Database Port:\t" + process.env.POSTGRES_PORT)
console.log("Database User:\t" + process.env.POSTGRES_USER)
console.log("Database DB:\t" + process.env.POSTGRES_DB)
console.log("Root Domain:\t" + process.env.CACHE_ROOT_DOMAIN)
console.log("Filesystem Dir:\t" + process.env.CACHE_FILESYSTEM_DIR)
console.log("Filesystem Max GB:\t" + process.env.CACHE_MAX_GB + ' GB')
console.log("\n\n\n")

let isReady = false
let Database: db
while(!isReady){
    try {
        Database = new db(true)
        await Database.connect()
        isReady = true
    }
    catch(e){
        console.log('Error whilst connecting to Database, is your Server up? Waiting 5 Seconds to retry', e)
        //Wait for 5 seconds
        await new Promise((resolve) => setTimeout(resolve, 5000))
    }
}
await Database.setupDB();

//Insert the default cache if it does not exist
await Database.insertServerSettings(
    process.env.CACHE_FILESYSTEM_DIR,
    process.env.LOG_LEVEL,
    process.env.CACHE_MAX_GB,
    process.env.CACHE_ROOT_DOMAIN
)
//Run migrations
await migrate(Database);

await Database.getAllCaches().then(async (caches:Array<cacheWithKeys>)=>{
    if(caches.length === 0){
        //Create a default cache
        console.log('No caches found, creating default cache')
        await Database.createCache("default", "Read", true, "none", "XZ", `${process.env.CACHE_ROOT_DOMAIN}`)
    }
    caches = await Database.getAllCaches()
    for (const cache of caches) {
        //Updating CACHE_ROOT_DOMAIN if needed
        if(cache.uri != process.env.CACHE_ROOT_DOMAIN && process.env.AUTO_FIX_CACHE_ROOT_DOMAIN !== "false"){
          console.log("Updating CACHE_ROOT_DOMAIN for cache \"" + cache.name + "\"")
          await Database.updateCacheURI(process.env.CACHE_ROOT_DOMAIN, cache.id)
        }
        if(cache.allowedKeys.length === 0 || cache.allowedKeys[0] === null){
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

//Check if there are "dangling" paths in the nar_file directory (i.e paths that are not in the database) and part files
const paths = await Database.getDirectAccess().query(`
    SELECT path, id FROM cache.hashes 
`)
for(const pathObj of paths.rows){
    if(!fs.existsSync(pathObj.path)){
        console.log(`Path ${pathObj.path} does not exist, removing from database`)
        //Delete the path from the database
        await Database.getDirectAccess().query(`
            DELETE FROM cache.request WHERE hash = ${pathObj.id}
        `)
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
    const cacheDir = `${process.env.CACHE_FILESYSTEM_DIR}/nar_files/${cache.name}`
    if(!fs.existsSync(cacheDir)){
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
