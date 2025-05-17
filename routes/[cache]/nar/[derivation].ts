import bodyParser, {type NextFunction, type Request, type Response} from "express";
import db from "../../../utils/db.ts";
import fs from "fs";
export const get = [
    bodyParser.json(),
    async (req: Request, res: Response, next: NextFunction) => {
        console.log('GET', req.url)
        if(req.method !== 'GET'){
            return res.status(405).json({
                error: 'Method not allowed',
            })
        }
        if(!req.params.cache || !req.params.derivation){
            return res.status(400).json({
                error: 'Missing cache name or hash',
            })
        }
        // Return the cacheInfo
        const nixDerivationHash = req.params.derivation
        const cache = req.params.cache
        const Database = new db();
        //console.log(nixDerivationHash, req.url)
        async function wrap(){
           const cacheID = await Database.getCacheID(cache)
            if(!cacheID){
                return res.status(400).json({})
            }
            // Check if the cache is public or private
            const cacheInfo = await Database.getCacheInfo(cacheID)
            if(!cacheInfo){
                return res.status(403).json({})
            }
            if(!cacheInfo){
                return res.status(400).json({})
            }

            //Get the derivation file path
            let filePath:{id:number, cache:number, path:string} = {
                id: -1,
                cache: -1,
                path: ''
            }
            try{
                filePath = await Database.getDerivation(cacheID, nixDerivationHash)
            }
            catch(e){
                console.log(`Derivation ${nixDerivationHash} not found`)
                return res.status(404).json({
                    error: 'Derivation not found',
                })
            }
            if(!filePath || filePath.id === -1 || filePath.cache === -1){
                console.log(`Derivation ${nixDerivationHash} not found`)
                return res.status(404).json({
                    error: 'Derivation not found',
                })
            }
            //Load the derivation file and send it to the client
            const data = fs.existsSync(filePath.path)
            if(!data){
                return res.status(404).json({
                    error: 'Derivation not found',
                })
            }
            res.status(200).sendFile(filePath.path, (err)=>{
                if(err){
                    console.error(err)
                    return res.status(500).json({
                        error: 'Internal server error',
                    })
                }
            })
            await Database.logRequest(filePath.id, filePath.cache, 'outbound')
            console.log(`Sent ${nixDerivationHash} to ${req.ip}`)
            return
        }

        await wrap().then(async ()=>{
            await Database.close()
            return
        })
        .catch(async (err) => {
            console.error(err)
            await Database.close()
            return res.status(500).json({
                error: 'Internal server error',
            })
        })
    }
]