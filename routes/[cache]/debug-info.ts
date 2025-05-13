import type { Request, Response } from 'express';
import db from '../../utils/db.ts';
export const get = async (req: Request, res: Response) => {
    if(req.method !== 'GET'){
        return res.status(405).json({
            error: 'Method not allowed',
        })
    }
    if(!req.params.cache){
        return res.status(400).json({
            error: 'Missing cache name or hash',
        })
    }

    // Check if the cache is public or private
    const Database = new db();
    async function wrap(){
        const cacheID = await Database.getCacheID(req.params.cache as string);
        if (cacheID === -1) {
            return res.status(404).json({
                error: "Cache not found",
            });
        }
        let cache = await Database.getCacheInfo(cacheID);
        cache.publicSigningKeys[0] = `${cache.name}:${cache.publicSigningKeys[0]}`
        await Database.close()
        if(!cache.isPublic){
            return res.status(400).json({
                error: "Cache not allowed"
            })
        }
        return res.status(200).json(cache)
    }
    await wrap()
}