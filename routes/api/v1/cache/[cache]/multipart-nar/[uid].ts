import bodyParser, {type Request, type Response} from "express";
import {isAuthenticated} from "../../../../../../utils/middlewares/auth.ts";

export const post = [
    bodyParser.json(),
    async (req:Request, res:Response)=>{
        if(req.method !== 'POST'){
            res.status(405).send('Method Not Allowed');
            return;
        }
        console.log(req.url)
        //Check if the user is authenticated
        const auth = await isAuthenticated(req, res, async () => {
            return true
        })
        if(!auth){
            return;
        }
        console.log(req.body, req.headers)
        return res.status(200).json({
            //@ts-ignore
            uploadUrl: `http://127.0.0.1:3000/upload/${req.params.cache}/${req.params.uid}?md5=${req.body.contentMD5}&token=${req.headers.authorization.split(" ")[1]}&part=${req.query.partNumber}`,
        })
    }
]