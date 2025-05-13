import db from "../../utils/db";
import type { Request, Response } from "express";
export const get = [
    async (req: Request, res: Response) => {
        if(req.method !== 'GET'){
            res.status(405).send('Method Not Allowed');
            return;
        }
        console.log(req.url)

        const cacheName = req.params.cache as string;
        if(!cacheName){
            return res.status(400).json({
                error: 'Missing cache name',
            })
        }

        const Database = new db();
        async function wrap(){
            const cacheID = await Database.getCacheID(cacheName);
            if(cacheID === -1){
                res.status(404).send('Cache Not Found');
                return;
            }

            const cacheInfo = await Database.getCacheInfo(cacheID);
            if(!cacheInfo){
                res.status(404).send('Cache Not Found');
                return;
            }
            if(!cacheInfo.isPublic){
                res.status(403).send('Cache Not Public');
            }

            return res.status(200).send(`
StoreDir: /nix/store
WantMassQuery: 1
Priority: 1
`)
        }

        await wrap().then(async ()=>{
            return
        })
            .catch((err)=>{
                console.log(err)
                res.status(500).json({
                    error: 'Internal Server Error',
                })
            })
            .finally(async ()=>{
                await Database.close()
            })
    }
]