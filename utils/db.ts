import { Client } from 'pg';
import type {cache, storeNarInfo} from "./types.d/dbTypes.ts";
import type {CacheInfo, narUploadSuccessRequestBody} from "./types.d/apiTypes.ts";
export default class Database {
    private db:Client = new Client({
        connectionString: process.env.POSTGRES_CONNECTION_STRING,
    })

    constructor(){
        try{
            this.db.connect()
        }
        catch(e){
            console.error('Error whilst opening database:', e)
        }

        //Try to create the cache and store hash table
        try{
        }
        catch(e){
            console.error('Error whilst creating tables:', e)
        }
    }

    public async setupDB():Promise<void>{

        await this.db.query(`
                CREATE SCHEMA IF NOT EXISTS cache
            `)
        await this.db.query(`
                CREATE TABLE IF NOT EXISTS cache.caches 
                    (
                        id SERIAL PRIMARY KEY,
                        githubUsername TEXT,
                        isPublic BOOLEAN,
                        name TEXT,
                        permission TEXT,
                        preferredCompressionMethod TEXT,
                        publicSigningKeys TEXT,
                        allowedKeys TEXT[],
                        uri TEXT,
                        priority INTEGER DEFAULT 40
                    )
            `)

        await this.db.query(`
                create table IF NOT EXISTS cache.hashes(
                    id      SERIAL                    not null
                        constraint hashes_pk
                            primary key,
                    path      TEXT                    not null,
                    cache     integer                 not null
                        constraint cacheFK
                            references cache.caches,
                    updatedAt TIMESTAMP default now() not null,
                    cDeriver TEXT NOT NULL,
                    cFileHash TEXT NOT NULL,
                    cFileSize BIGINT NOT NULL,
                    cNarHash TEXT NOT NULL,
                    cNarSize BIGINT NOT NULL,
                    cReferences TEXT[] NOT NULL,
                    cSig TEXT,
                    cStoreHash TEXT NOT NULL,
                    cStoreSuffix TEXT NOT NULL,
                    parts JSONB[] NOT NULL,
                    compression TEXT NOT NULL
                );
            `)
    }

    public async getCaches():Promise<Array<cache>> {
        try{
            const caches = await this.db.query('SELECT * FROM cache.caches')
            return caches.rows
        }
        catch(e){
            console.error('Error whilst getting caches:', e)
            return []
        }
    }

    public async createStorePath(cache:string, narReturn:narUploadSuccessRequestBody, uid:string, compression: "xz" | 'zstd'):Promise<void>{
        //Check if the cache exists (just to be sure)
        const cacheID = await this.getCacheID(cache)
        if(cacheID === -1){
            throw new Error(`Cache ${cacheID} not found`)
        }


        await this.db.query(`
            INSERT INTO cache.hashes 
                (path, cache, cderiver, cfilehash, cfilesize, cnarhash, cnarsize, creferences, csig, cstorehash, cstoresuffix, parts, compression)
            VALUES 
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
            [
                `${process.env.CACHE_FILESYSTEM_DIR}/nar_files/${cache}/${uid}.nar.${compression}`,
                await this.getCacheID(cache),
                narReturn.narInfoCreate.cDeriver,
                narReturn.narInfoCreate.cFileHash,
                narReturn.narInfoCreate.cFileSize,
                narReturn.narInfoCreate.cNarHash,
                narReturn.narInfoCreate.cNarSize,
                narReturn.narInfoCreate.cReferences,
                narReturn.narInfoCreate.cSig,
                narReturn.narInfoCreate.cStoreHash,
                narReturn.narInfoCreate.cStoreSuffix,
                narReturn.parts.map((part)=>{return JSON.stringify(part)}).map((part)=>{return JSON.parse(part)}), //Convert the parts to JSONB
                compression
            ]
        )
    }


    public async getCacheID(cache:string):Promise<number> {
        try{
            const caches = await this.db.query('SELECT id FROM cache.caches WHERE name = $1', [cache])
            if(caches.rows.length === 0){
                return -1
            }
            else if(caches.rows.length > 1){
                console.error('Multiple caches with the same name found:', caches.rows)
                return -1
            }
            return caches.rows[0].id
        }
        catch(e){
            console.error('Error whilst getting cache ID:', e)
            return -1
        }
    }

    public async getCacheInfo(cache:number):Promise<CacheInfo>{
        try{
            const caches = await this.db.query('SELECT * FROM cache.caches WHERE id = $1', [cache])
            if(caches.rows.length === 0 || caches.rows.length > 1){
               throw new Error('Cache not found or multiple caches with the same ID found')
            }
            //console.log(caches.rows)
            return {
                githubUsername: caches.rows[0].githubusername ? caches.rows[0].githubusername : '',
                isPublic: caches.rows[0].ispublic,
                name: caches.rows[0].name,
                permission: caches.rows[0].permission,
                preferredCompressionMethod: caches.rows[0].preferredcompressionmethod,
                publicSigningKeys: [caches.rows[0].publicsigningkeys],
                uri: caches.rows[0].uri,

            }

        }
        catch(e){
            console.error('Error whilst getting cache info:', e)
            return {
                githubUsername: '',
                isPublic: true,
                name: '',
                permission: '',
                preferredCompressionMethod: '',
                publicSigningKeys: [''],
                uri: ''
            }
        }
    }

    public async getNarInfo(cache:string, hash:string):Promise<Array<string>>{
        try{
            const narInfo = await this.db.query('SELECT * FROM cache.hashes WHERE cache = $1 AND cStoreHash IN ($2)', [cache, hash])
            return []
        }
        catch(e){
            console.error('Error whilst getting hash:', e)
            return []
        }
    }

    public async getAvailablePaths(cache:string, paths:Array<string>):Promise<Array<string>>{
        const cacheID = await this.getCacheID(cache)
        if(cacheID === -1){
            throw new Error(`Cache ${cache} not found`)
        }
        //Select all the paths that are in the database based on the paths given to use by the calling function
        const pathsInDB = await this.db.query(`
            SELECT cstorehash FROM cache.hashes WHERE cache = $1 AND cstorehash IN ('${paths.join("','")}')
        `, [cacheID])

        //Return only the cstore hashes
        return pathsInDB.rows.map((row)=>{return row.cstorehash})

    }

    public async close():Promise<void> {
        return await this.db.end();
    }

    public async getAllCaches():Promise<Array<cache>> {
        const caches = await this.db.query('SELECT * FROM cache.caches')
        return caches.rows.map((row)=>{return {
            id: row.id,
            githubUsername: row.githubusername,
            isPublic: row.ispublic,
            name: row.name,
            permission: row.permission,
            preferredCompressionMethod: row.preferredcompressionmethod,
            publicSigningKeys: row.publicsigningkeys,
            allowedKeys: row.allowedkeys,
            uri: row.uri
        }})
    }
    public async getAllowedKeys(cache:number):Promise<Array<string>> {
        const caches = await this.db.query('SELECT allowedKeys FROM cache.caches WHERE id = $1', [cache])
        if(caches.rows.length === 0){
            throw new Error('Cache not found')
        }
        return caches.rows[0].allowedkeys
    }
    public async appendApiKey(cache:number, key:string):Promise<void> {
        await this.db.query('UPDATE cache.caches SET allowedKeys = array_append(allowedKeys, $1) WHERE id = $2', [key, cache])
    }

    public async getStoreNarInfo(cache:number, hash:string): Promise<storeNarInfo[]>{
        const hashResults = await this.db.query('SELECT * FROM cache.hashes WHERE cache = $1 AND cstorehash = $2', [cache, hash])
        return hashResults.rows.map((row)=>{
            return {
                id: row.id,
                cache: row.cache,
                cderiver: row.cderiver,
                cfilehash: row.cfilehash,
                cfilesize: row.cfilesize,
                cnarhash: row.cnarhash,
                cnarsize: row.cnarsize,
                creferences: row.creferences,
                csig: row.csig,
                cstorehash: row.cstorehash,
                cstoresuffix: row.cstoresuffix,
                parts: row.parts,
                path: row.path,
                compression: row.compression,
            } as storeNarInfo
        })
    }

    public async getDerivationPath(cache:number, derivation:string): Promise<string>{
        const hashResults = await this.db.query('SELECT path FROM cache.hashes WHERE cache = $1 AND cstorehash = $2', [cache, derivation])
        if(hashResults.rows.length === 0){
            throw new Error('Derivation not found')
        }
        return hashResults.rows[0].path
    }

    public async createCache(name:string, permission:string, isPublic:boolean, githubUsername:string, preferredCompressionMethod:string, uri:string):Promise<void>{
        await this.db.query(`
            INSERT INTO cache.caches (name, permission, isPublic, githubUsername, preferredCompressionMethod, uri, publicSigningKeys, allowedKeys) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [name, permission, isPublic, githubUsername, preferredCompressionMethod, uri, '', []])
    }

    public getDirectAccess():Client{
        return this.db
    }

    public async deletePath(id:number):Promise<void>{
        await this.db.query('DELETE FROM cache.hashes WHERE id = $1', [id])
    }

    public async appendPublicKey(id:number, key:string):Promise<void>{
        await this.db.query(
            "UPDATE cache.caches SET publicSigningKeys = $1 WHERE id = $2",
            [key, id]
        )
    }
}