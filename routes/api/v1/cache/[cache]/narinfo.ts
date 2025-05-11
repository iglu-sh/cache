import bodyParser, {type Request, type Response} from "express";
import type {CacheInfo} from "../../../../../utils/types.d/apiTypes.ts";
import db from "../../../../../utils/db.ts";

export const post = [
    bodyParser.json(),
    async (req: Request, res: Response) => {
        if(req.method !== 'POST'){
            res.status(405).send('Method Not Allowed');
            return;
        }
        const Database = new db();
        // Check if cache exists
        if(req.params.cache === undefined || await Database.getCacheID(req.params.cache) === -1){
            res.status(404).send('Cache Not Found');
            return;
        }

        //Validate if the body is valid (i.e it is a JSON Array of only strings)
        req.body.map((x: any) => {
            if(typeof x !== 'string'){
                console.error('WRONG', x)
            }
        })

        if(!Array.isArray(req.body) || req.body.map((x: any)=> typeof x === 'string').includes(false)){
            res.status(400).send('Invalid Body');
            return;
        }

        const pathsInDB = await Database.getAvailablePaths(req.params.cache, req.body)
        await Database.close();

        //Build a new Array with the paths that are not in the database
        const pathsNotInDB = req.body.filter((x: string) => !pathsInDB.includes(x))

        return res.status(200).json(pathsNotInDB)
    }
]