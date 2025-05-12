import { type NextFunction, type Request, type Response } from 'express';
import db from '../../utils/db.ts';
export const get = async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET"){
        return res.status(405).json({
            error: "Method not allowed",
        });
    }
    if(!req.params.cache || !req.params.hash){
        return res.status(400).json({
            error: "Missing cache name or hash",
        });
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
        const cache = await Database.getCacheInfo(cacheID);
        if(!cache.isPublic){
            return res.status(400).json({
                error: "Cache not allowed"
            })
        }

        //Check if the requested hash is in this cache
        const storeNar = await Database.getStoreNarInfo(cacheID, req.params.hash as string);
        if(storeNar.length === 0 || !storeNar[0]){
            return res.status(404).json()
        }
        //Build the nar info and send it to the client
        const narInfo = `StorePath: /nix/store/${storeNar[0].cderiver}\n
URL: nar/${storeNar[0].cstorehash}\n
Compression: ${cache.preferredCompressionMethod.toLowerCase()}\n
FileHash: sha256:${storeNar[0].cfilehash}\n
FileSize: ${storeNar[0].cfilesize}\n
NarHash: ${storeNar[0].cnarhash}\n
NarSize: ${storeNar[0].cnarsize}\n
References: ${storeNar[0].creferences.join(" ")}\n
Deriver: ${storeNar[0].cderiver}\n
Sig: cache.nixos.org-1:owbhekY6uL3azcjYNASs8xhrNKdoyUSmYKM8Xs1qlDuM4MdKLnutsn2PhToGaMxZb3e3MAWcTfW4zSLIPVhYDQ==`
        const headers = new Headers()
        headers.append("content-type", "text/x-nix-narinfo")
        res.setHeaders(headers)
        return res.status(200).send(narInfo)
    }
    await wrap().then(async ()=>{
        await Database.close()
    })
        .catch(e => {
            console.log(e)
            return res.status(500).json({
                error: "Internal server error",
            });
        });

}