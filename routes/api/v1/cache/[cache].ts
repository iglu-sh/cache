import bodyParser, { type Request, type Response } from 'express'
import type {CacheInfo} from "../../../../utils/types.d/apiTypes.ts";
import db from "../../../../utils/db.ts";
import {isAuthenticated} from "../../../../utils/middlewares/auth.ts";
export const get = [
    bodyParser.json(),
    async (req: Request, res: Response) => {
        if(req.method !== 'GET'){
            res.status(405).send('Method Not Allowed');
            return;
        }
        //Check if the user is authenticated
        const auth = await isAuthenticated(req, res, async () => {
            return true
        })
        if(!auth){
            return;
        }

        const Database = new db();

        //This function wraps the response so that the Database can be closed at the end
        async function wrap(){

            if(req.params.cache === undefined || await Database.getCacheID(req.params.cache) === -1){
                res.status(404).send('Cache Not Found');
                return;
            }
            const cache = await Database.getCacheInfo(await Database.getCacheID(req.params.cache))
            return res.json(cache);
        }
        await wrap().then(async ()=>{
            await Database.close()
        }).catch(e=>{
            console.error(e)
            res.status(500).send('Internal Server Error');
        })
    }
]