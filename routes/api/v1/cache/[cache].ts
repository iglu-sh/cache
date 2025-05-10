import type { Request, Response } from 'express'
import { Router } from 'express'
import caches from '../../../../utils/caches.json';
import type {CacheInfo} from "../../../../utils/types.d/apiTypes.ts";
export const get = async (req: Request, res: Response) => {
    if(req.method !== 'GET'){
        res.status(405).send('Method Not Allowed');
        return;
    }
    if(caches.caches.filter(cache => cache.name === req.params.cache).length === 0){
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