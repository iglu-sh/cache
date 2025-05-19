import { Client } from 'pg';
import type {cache, cacheWithKeys, storeNarInfo} from "./types.d/dbTypes.ts";
import type {CacheInfo, narUploadSuccessRequestBody} from "./types.d/apiTypes.ts";
export default class Database {
    
    private db:Client = new Client({
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
    })
    
    constructor(skipConnection:boolean = false){
        if(!skipConnection){
            this.db.connect()
        }
    }
    public async connect(){
        console.log(`Connecting to the database`)
        await this.db.connect()
        console.log(`Connected to the database`)
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

        await this.db.query(`
            create table if not exists cache.request
            (
                id       bigserial
                    constraint request_pk
                        primary key,
                hash     BIGINT
                    constraint hash_fk
                        references cache.hashes,
                cache_id bigint
                    constraint cache_fk
                        references cache.caches,
                type     TEXT,
                time     timestamp default now() not null
            );
        `)

        await this.db.query(`
            create table if not exists cache.keys
                (
                id serial constraint keys_pk primary key,
                cache_id int constraint cache_fk references cache.caches,
                name text not null,
                hash text not null,
                description text,
                created_at timestamp default now() not null,
                permissions text default 'none'
            )
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
            RETURNING *
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
        ).then(async (res)=>{
            await this.logRequest(res.rows[0].id, res.rows[0].cache, "inbound")
        })
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
                priority: caches.rows[0].priority,
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
                uri: '',
                priority: 40,
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
        //TODO: This is not safe, we should use a parameterized query
        const pathsInDB = await this.db.query(`
            SELECT cstorehash FROM cache.hashes WHERE cache = $1 AND cstorehash IN ('${paths.join("','")}')
        `, [cacheID])

        //Return only the cstore hashes
        return pathsInDB.rows.map((row)=>{return row.cstorehash})

    }

    public async close():Promise<void> {
        return await this.db.end();
    }

    public async getAllCaches():Promise<Array<cacheWithKeys>> {
        const caches = await this.db.query(`
        SELECT c.*, array_agg(k.hash) as allowedKeys FROM cache.caches c
            LEFT JOIN cache.keys k ON c.id = k.cache_id
        GROUP BY c.id
        `)
        return caches.rows.map((row)=>{
            return {
            id: row.id,
            githubUsername: row.githubusername,
            isPublic: row.ispublic,
            name: row.name,
            permission: row.permission,
            preferredCompressionMethod: row.preferredcompressionmethod,
            publicSigningKeys: row.publicsigningkeys,
            uri: row.uri,
            allowedKeys : row.allowedkeys,
            priority: row.priority
        }})
    }
    public async getAllowedKeys(cache:number):Promise<Array<string>> {
        const caches = await this.db.query('SELECT array_agg(hash) as allowedKeys FROM cache.keys WHERE cache_id = $1 GROUP BY cache_id', [cache])
        return caches.rows[0].allowedkeys
    }
    public async appendApiKey(cache:number, key:string):Promise<void> {
        //Hash the key
        const hash = await Bun.password.hash(key)
        await this.db.query(`
            INSERT INTO cache.keys (cache_id, name, description, hash) VALUES ($1, $2, $3, $4)
        `, [cache, "Starting Key", "With love from the Iglu team", hash])
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

    public async getDerivation(cache:number, derivation:string): Promise<{
        id:number,
        cache:number,
        path: string
    }>{
        const hashResults = await this.db.query('SELECT id, path, cache FROM cache.hashes WHERE cache = $1 AND cstorehash = $2', [cache, derivation])
        if(hashResults.rows.length === 0){
            throw new Error('Derivation not found')
        }
        return hashResults.rows[0]
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

    public async logRequest(hashID:number, cacheID:number, type:string):Promise<void>{
        await this.db.query(`
            INSERT INTO cache.request (hash, cache_id, type) VALUES($1, $2, $3)
        `,[hashID, cacheID, type])
    }

    public async updateCacheURI(uri:string, cacheID:number):Promise<void>{
      await this.db.query(`
          UPDATE cache.caches SET uri = $1 WHERE id = $2
      `, [uri, cacheID])
    }
}
