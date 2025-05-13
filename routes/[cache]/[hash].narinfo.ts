import { type NextFunction, type Request, type Response } from 'express';
import db from '../../utils/db.ts';
export const get = async (req: Request, res: Response, next: NextFunction) => {
    console.log(req.url)
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
            console.log(`Store nar ${req.params.hash} not cached`)
            return res.status(404).json()
        }
        //Build the nar info and send it to the client
        const narInfo = `StorePath: /nix/store/${storeNar[0].cderiver}
URL: nar/${storeNar[0].cstorehash}
Compression: ${cache.preferredCompressionMethod.toLowerCase()}
FileHash: sha256:${storeNar[0].cfilehash}
FileSize: ${storeNar[0].cfilesize}
NarHash: ${storeNar[0].cnarhash}
NarSize: ${storeNar[0].cnarsize}
References: ${storeNar[0].creferences.join(" ")}
Deriver: ${storeNar[0].cderiver}
Sig: ${cache.publicSigningKeys}
`

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