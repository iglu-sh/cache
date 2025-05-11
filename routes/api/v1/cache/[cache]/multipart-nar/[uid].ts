import bodyParser, {type Request, type Response} from "express";

export const post = [
    bodyParser.json(),
    async (req:Request, res:Response)=>{
        //console.log(req.body);
        //console.log(req)
        //console.log(req.headers, req.body)
        return res.status(200).json({
            uploadUrl: `http://127.0.0.1:3000/upload/${req.params.cache}/${req.params.uid}?md5=${req.body.contentMD5}`,
        })
    }
]