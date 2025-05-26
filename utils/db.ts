import { Client } from 'pg';
import type {cache, cacheWithKeys, storeNarInfo} from "./types.d/dbTypes.ts";
import type {CacheInfo, narUploadSuccessRequestBody} from "./types.d/apiTypes.ts";
import { PGlite } from '@electric-sql/pglite'

export default class Database {
    
    private static db:Client | PGlite;
    
    constructor(){

        if(Database.db) return

        if(!process.env.PG_MODE || process.env.PG_MODE != 'lite'){
            console.log('Using PostgreSQL as the database')
            Database.db = new Client({
                user: process.env.POSTGRES_USER,
                password: process.env.POSTGRES_PASSWORD,
                host: process.env.POSTGRES_HOST,
                port: process.env.POSTGRES_PORT,
                database: process.env.POSTGRES_DB,
            });
        }
        else{
            Database.db = new PGlite("/tmp/pg_data")
        }
    }
    public async connect(){
        console.log(`Connecting to the database`)
        if(!process.env.PG_MODE || process.env.PG_MODE != 'lite'){
            await Database.db.connect()
        }
        else{
            console.log(`Using PGlite so not connecting`)
        }
        console.log(`Connected to the database`)
    }
    public async setupDB():Promise<void>{
        await Database.db.query(`
                CREATE SCHEMA IF NOT EXISTS cache
            `)
        await Database.db.query(`
                CREATE TABLE IF NOT EXISTS cache.caches 
                    (
                        id SERIAL PRIMARY KEY,
                        githubUsername TEXT,
                        isPublic BOOLEAN,
                        name TEXT,
                        permission TEXT,
                        preferredCompressionMethod TEXT,
                        uri TEXT,
                        priority INTEGER DEFAULT 40
                    )
            `)

        await Database.db.query(`
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

        await Database.db.query(`
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

        await Database.db.query(`
            create table if not exists cache.keys
                (
                id serial constraint keys_pk primary key,
                name text not null,
                hash text not null,
                description text,
                created_at timestamp default now() not null,
                updated_at timestamp default now() not null
            )
        `)
        await Database.db.query(`
            create table if not exists cache.cache_key 
            (
                id serial constraint cache_key_pk primary key,
                cache_id int constraint cache_fk references cache.caches,
                key_id int constraint keys_fk references cache.keys,
                permissions text default 'none',
                created_at timestamp default now() not null
            )
        `)
        await Database.db.query(`
            DROP TABLE IF EXISTS cache.server_config;
        `)
        await Database.db.query(`
            create table if not exists cache.server_config
            (
                id serial constraint server_config_pk primary key,
                fs_storage_path text not null,
                log_level text default 'info',
                max_storage_size bigint,
                cache_root_domain text
            )
        `)

        await Database.db.query(`
            create table if not exists cache.public_signing_keys
                (
                id serial constraint signing_keys_pk primary key,
                name text not null,
                key text not null,
                description text,
                created_at timestamp default now() not null
            );
        `)
        await Database.db.query(`
            create table if not exists cache.signing_key_cache_api_link
            (
                id serial constraint signing_api_cache_pk primary key,
                cache_id int constraint signing__cache_fk references cache.caches,
                key_id int constraint signing__keys_fk references cache.keys,
                signing_key_id int constraint signing_key_fk references cache.public_signing_keys
            );
        `)
        await Database.db.query(`
            create table if not exists cache.builders
            (
                id serial constraint builders_pk primary key,
                name text not null,
                description text,
                cache_id int constraint builders_cache_fk references cache.caches,
                repository text not null,
                branch text not null,
                gitUsername text not null,
                gitKey text not null,
                enabled boolean default true,
                trigger text default 'manual',
                schedule text not null,
                "buildOptions.cores" integer default 1,
                "buildOptions.maxJobs" integer default 1,
                "buildOptions.keep_going" boolean default false,
                "buildOptions.extraArgs" text default '',
                "buildOptions.substituters" text[] not null default '{"https://cache.nixos.org"}',
                "buildOptions.trustedPublicKeys" text[] not null default '{"cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="}',
                "buildOptions.command" text default 'nix-build',
                "buildOptions.cachix.push" boolean default false,
                "buildOptions.cachix.target" text default '',
                "buildOptions.cachix.apiKey" text default '',
                "buildOptions.cachix.signingKey" text default '',
                "buildOptions.cachix.cachixPushSourceDir" text default 'result'
            )
        `)
        await Database.db.query(`
            create table if not exists cache.builder_runs
            (
                id serial constraint server_runs primary key,
                builder_id int constraint builder_fk references cache.builders,
                status text not null,
                time timestamp default now() not null,
                gitCommit text not null,
                duration integer not null, -- in seconds
                log text
            )
        `)
        console.log("Database setup complete")
    }

    public async insertServerSettings(fs_storage_path:string, log_level:string, max_storage_size:number, cache_root_domain:string):Promise<void>{
        await Database.db.query(`
            INSERT INTO cache.server_config (fs_storage_path, log_level, max_storage_size, cache_root_domain) 
            VALUES ($1, $2, $3, $4)
        `, [fs_storage_path, log_level, max_storage_size, cache_root_domain])
    }

    public async getCaches():Promise<Array<cache>> {
        try{
            const caches = await Database.db.query('SELECT * FROM cache.caches')
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


        await Database.db.query(`
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
            const caches = await Database.db.query('SELECT id FROM cache.caches WHERE name = $1', [cache])
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
            const caches = await Database.db.query(`
                SELECT caches.*, array_agg(psk.key) as publicSigningKeys
                FROM cache.caches
                    INNER JOIN cache.signing_key_cache_api_link skcal ON caches.id = skcal.cache_id
                    INNER JOIN cache.public_signing_keys psk ON skcal.signing_key_id = psk.id
                WHERE caches.id = $1
                GROUP BY caches.id 
            `, [cache])
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
                publicSigningKeys: caches.rows[0].publicsigningkeys,
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
            const narInfo = await Database.db.query('SELECT * FROM cache.hashes WHERE cache = $1 AND cStoreHash IN ($2)', [cache, hash])
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
        const pathsInDB = await Database.db.query(`
            SELECT cstorehash FROM cache.hashes WHERE cache = $1 AND cstorehash = ANY($2)
        `, [cacheID, paths])

        //Return only the cstore hashes
        return pathsInDB.rows.map((row)=>{return row.cstorehash})

    }

    public async close():Promise<void> {
        //return await Database.db.end();
    }

    public async getAllCaches():Promise<Array<cacheWithKeys>> {
        const caches = await Database.db.query(`
            SELECT c.*, array_agg(k.hash) as allowedKeys, array_agg(psk.key) as publicsigningkeys FROM cache.caches c
              LEFT JOIN cache.cache_key ck ON c.id = ck.cache_id
              LEFT JOIN cache.keys k ON ck.key_id = k.id
              LEFT JOIN cache.signing_key_cache_api_link skcal ON skcal.cache_id = c.id
              LEFT JOIN cache.public_signing_keys psk ON psk.id = skcal.signing_key_id
            GROUP BY c.id;

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
        const caches = await Database.db.query(`
            SELECT array_agg(hash) as allowedKeys FROM cache.keys 
                INNER JOIN cache.cache_key ck ON keys.id = ck.key_id
            WHERE ck.cache_id = $1 GROUP BY ck.cache_id
        `, [cache])
        return caches.rows[0].allowedkeys
    }
    public async appendApiKey(cache:number, key:string):Promise<string> {
        //Hash the key
        //TODO: Find out if we need a secret key here (I hope not)
        const hasher = new Bun.CryptoHasher("sha512");
        hasher.update(key)
        const hash = hasher.digest("hex")
        const result = await Database.db.query(`
            INSERT INTO cache.keys (name, description, hash) VALUES ($1, $2, $3)
                RETURNING *;
        `, ["Starting Key", "With love from the Iglu team", hash])
        if(!result.rows || result.rows.length ===  0){
            throw new Error('Error whilst creating key')
        }

        const keyID = result.rows[0].id

        await Database.db.query(`
            INSERT INTO cache.cache_key (cache_id, key_id) VALUES ($1, $2)
        `, [cache, keyID])

        return hash
    }

    public async getStoreNarInfo(cache:number, hash:string): Promise<storeNarInfo[]>{
        const hashResults = await Database.db.query('SELECT * FROM cache.hashes WHERE cache = $1 AND cstorehash = $2', [cache, hash])
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
        const hashResults = await Database.db.query('SELECT id, path, cache FROM cache.hashes WHERE cache = $1 AND cstorehash = $2', [cache, derivation])
        if(hashResults.rows.length === 0){
            throw new Error('Derivation not found')
        }
        return hashResults.rows[0]
    }

    public async createCache(name:string, permission:string, isPublic:boolean, githubUsername:string, preferredCompressionMethod:string, uri:string):Promise<void>{
        await Database.db.query(`
            INSERT INTO cache.caches (name, permission, isPublic, githubUsername, preferredCompressionMethod, uri) 
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [name, permission, isPublic, githubUsername, preferredCompressionMethod, uri])
    }

    public getDirectAccess():Client{
        return Database.db
    }

    public async deletePath(id:number):Promise<void>{
        await Database.db.query('DELETE FROM cache.hashes WHERE id = $1', [id])
    }

    public async appendPublicKey(id:number, key:string, apiKey:string, bypassHasher?:boolean):Promise<void>{
        const hashedKey = new Bun.CryptoHasher("sha512")
        hashedKey.update(apiKey)
        let hash = hashedKey.digest("hex")

        //This is a workaround to be able to just pass a hash to the query later down the line
        if(bypassHasher){
            hash = apiKey
        }

        //Get the API key ID
        const keyID = await Database.db.query(`
            SELECT * FROM cache.keys WHERE hash = $1;
        `, [hash]).then((res)=>{
            if(res.rows.length === 0){
                throw new Error('API Key not found')
            }
            return res.rows[0].id
        })
        //Check if this key cache api key link already exists
        let publicKeyId;
        const isInDb = await Database.db.query(`
                SELECT * FROM cache.signing_key_cache_api_link WHERE cache_id = $1 AND key_id = $2
            `, [id, keyID]).then((res)=>{
            if(res.rows.length > 0){
                publicKeyId = res.rows[0].signing_key_id
                return true
            }
            return false
        })

        //Depending on the result we need to either update the key or insert a new one
        if(isInDb){
            //Update the key with the id we got
            await Database.db.query(`
                UPDATE cache.public_signing_keys SET key = $1 WHERE id = $2
            `, [key, publicKeyId])
        }
        else{
            //Insert the key into the public signing keys table
            const signingKey = await Database.db.query(`
                INSERT INTO cache.public_signing_keys (name, key, description) 
                VALUES ($1, $2, $3)
                RETURNING *
            `, ["Cachix Key", key, "Key uploaded by Cachix"])

            //Insert the key into the signing key cache api link table
            await Database.db.query(`
                INSERT INTO cache.signing_key_cache_api_link (cache_id, key_id, signing_key_id) 
                VALUES ($1, $2, $3)
        `, [id, keyID, signingKey.rows[0].id])
        }
    }

    public async logRequest(hashID:number, cacheID:number, type:string):Promise<void>{
        await Database.db.query(`
            INSERT INTO cache.request (hash, cache_id, type) VALUES($1, $2, $3)
        `,[hashID, cacheID, type])
    }

    public async updateCacheURI(uri:string, cacheID:number):Promise<void>{
      await Database.db.query(`
          UPDATE cache.caches SET uri = $1 WHERE id = $2
      `, [uri, cacheID])
    }
}
