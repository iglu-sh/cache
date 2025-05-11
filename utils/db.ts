import { Client } from 'pg';
import type {cache} from "./types.d/dbTypes.ts";
import type {CacheInfo} from "./types.d/apiTypes.ts";
export default class Database {
    private db:Client = new Client({
        user: "postgres",
        password: "postgres",
        host: "localhost",
        port: 5432,
        database: "cache",
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
            this.db.query(`
                CREATE SCHEMA IF NOT EXISTS cache
            `)
            this.db.query(`
                CREATE TABLE IF NOT EXISTS cache.caches 
                    (
                        id SERIAL PRIMARY KEY,
                        githubUsername TEXT,
                        isPublic BOOLEAN,
                        name TEXT,
                        permission TEXT,
                        preferredCompressionMethod TEXT,
                        publicSigningKeys TEXT[],
                        uri TEXT
                    )
            `)

            this.db.query(`
                create table IF NOT EXISTS cache.hashes(
                    hash      TEXT                    not null
                        constraint hashes_pk
                            primary key,
                    path      TEXT                    not null,
                    cache     integer                 not null
                        constraint cacheFK
                            references cache.caches,
                    updatedAt TIMESTAMP default now() not null
                );
            `)
        }
        catch(e){

        }
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

    public async getCahceInfo(cache:number):Promise<CacheInfo>{
        try{
            const caches = await this.db.query('SELECT * FROM cache.caches WHERE id = $1', [cache])
            if(caches.rows.length === 0 || caches.rows.length > 1){
               throw new Error('Cache not found or multiple caches with the same ID found')
            }

            return {
                githubUsername: caches.rows[0].githubUsername,
                isPublic: caches.rows[0].isPublic,
                name: caches.rows[0].name,
                permission: caches.rows[0].permission,
                preferredCompressionMethod: caches.rows[0].preferredCompressionMethod,
                publicSigningKeys: caches.rows[0].publicSigningKeys,
                uri: caches.rows[0].uri
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
                publicSigningKeys: [],
                uri: ''
            }
        }
    }

    public async getNarInfo(cache:string, hash:string):Promise<Array<string>>{
        try{
            const narInfo = await this.db.query('SELECT * FROM cache.hashes WHERE cache = $1 AND hash IN ($2)', [cache, hash])
            console.log(narInfo)
            return []
        }
        catch(e){
            console.error('Error whilst getting hash:', e)
            return []
        }
    }

    public async close():Promise<void> {
        return await this.db.end();
    }
}