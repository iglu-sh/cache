import db from "../../../../../utils/db.ts";
import bodyParser, {type Request, type Response} from "express";
import {randomUUID} from "node:crypto";

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

        //Get a random uuid for relating the store hash to the upload
        const uid = randomUUID()
        await Database.close();
        return res.status(200).json({
            "narId": uid,
            "uploadId": uid,
        })
    }
]