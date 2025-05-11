import bodyParser, { type Request, type Response } from 'express'
import type {CacheInfo} from "../../../../utils/types.d/apiTypes.ts";
import db from "../../../../utils/db.ts";
export const get = [
    bodyParser.json(),
    async (req: Request, res: Response) => {
        if(req.method !== 'GET'){
            res.status(405).send('Method Not Allowed');
            return;
        }
        const Database = new db();
        // Check if cache exists
        if(req.params.cache === undefined || await Database.getCacheID(req.params.cache) === -1){
            res.status(404).send('Cache Not Found');
            return;
        }

        const returnInfo:CacheInfo = {
            "githubUsername": "",
            "isPublic": true,
            "name": "main",
            "permission": "Read",
            "preferredCompressionMethod": "XZ",
            "publicSigningKeys": [
                "0.0.0.0-1:CjwLgnUb157vhyNHrmBgaRGUISGIY6Q8rJ9oKK95gA8="
            ],
            "uri": "http://0.0.0.0"
        }
        return res.json(returnInfo);
    }
]