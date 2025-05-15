import type {NextFunction, Request, Response} from 'express'
import bodyParser from "express";
import fs from "fs";
import raw from 'express'
import db from "./utils/db";
import createRouter, {router} from "express-file-routing"
import type {cache} from "./utils/types.d/dbTypes.ts";
import {makeApiKey} from "./utils/apiKeys.ts";
import 'dotenv/config'
const app = require('express')()
const pino = require('pino-http')()
//Check if the environment variables are set
if(!process.env.CACHE_ROOT_DOMAIN){
    //Show an error message as we cannot create a cache without a root domain
    console.error('No CACHE_ROOT_DOMAIN set, please set it in the .env file or your environment')
    process.exit(1)
}
if(!process.env.POSTGRES_CONNECTION_STRING){
   //Show an error message as we cannot connect to the database
    console.error('No POSTGRES_CONNECTION_STRING set, please set it in the .env file or your environment')
    process.exit(1)
}
if(!process.env.CACHE_FILESYSTEM_DIR){
    //We need a directory to store the files in
    console.error('No CACHE_FILESYSTEM_DIR set, please set it in the .env file or your environment')
    process.exit(1)
}
if(!process.env.CACHE_JWT_SECRET){
    //A secret must be provided to sign the jwt tokens
    console.error('No CACHE_JWT_SECRET set, please set it in the .env file or your environment')
    process.exit(1)
}
// Print config
const split = process.env.POSTGRES_CONNECTION_STRING.split(":")
const split2 = split[2].split("@")
const split3 = split[3].split("/")

let db_port = split3[0]
let db_host = split2[1]
let db_user = split[1]?.replaceAll("/", "")
let db_db = split3[1]

console.log("----------CONFIG----------")
console.log("Database Host:\t" + db_host)
console.log("Database Port:\t" + db_port)
console.log("Database User:\t" + db_user)
console.log("Database DB:\t" + db_db)

let Database = new db(true)
let isReady = false
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
await Database.getAllCaches().then(async (caches:Array<cache>)=>{
    if(caches.length === 0){
        //Create a default cache
        console.log('No caches found, creating default cache')
        await Database.createCache("default", "Read", true, "none", "XZ", `${process.env.CACHE_ROOT_DOMAIN}`)
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

//Check if there are "dangling" paths in the nar_file directory (i.e paths that are not in the database) and part files
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
