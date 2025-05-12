import jwt from "jsonwebtoken";
import db from "../db";
export async function isAuthenticated (req: any, res: any, next: any):Promise<boolean>{
        // Check if the request has an authorization header
        const authHeader = req.headers.authorization ? req.headers.authorization : req.query.token ? `bearer ${req.query.token}` : undefined;
        if(!authHeader){
            res.status(403).json({ message: 'Forbidden' });
            return false;
        }
        // Check if the authorization header is in the format "Bearer <token>"
        const token = authHeader.split(' ')[1];
        if (!token) {
            res.status(403).json({ message: 'Forbidden' });
            return false
        }
        // Verify the token
        // Check if the token is valid
        let decoded:any
        try{
            decoded = jwt.verify(token, 'verysecretencryptionkey');
        }
        catch(e){
            //Return a 403 error if the token is invalid
            res.status(403).json({ message: 'Forbidden' });
            return false;
        }

        if (!decoded) {
            res.status(403).json({ message: 'Forbidden' });
            return false
        }
        // Check if the decoded token  matches the cache name
        if (!decoded.name || decoded.name !== req.params.cache) {
            res.status(403).json({ message: 'Forbidden' });
            return false
        }

        // If everything is fine so far we can check if this api key is allowed to push this cache
        // Check if the cache exists
        const Database = new db();

        //Create a wrapper function to close the database connection after returning
        async function wrap(){
            const cacheID = await Database.getCacheID(req.params.cache)
            if(cacheID === -1){
                res.status(404).json({ message: 'Cache Not Found' });
                return false
            }

            //Check if the api key is allowed to push this cache
            const keys = await Database.getAllowedKeys(cacheID)
            if(keys.length === 0 || !keys.includes(token)){
                res.status(403).json({ message: 'Forbidden' });
                return false
            }
            return true
        }
        return await wrap().then(async (result)=>{
            await Database.close()
            return result
        }).catch(e=>{
            res.status(500).send("Internal Server Error");
            console.error(e)
            return false
        });
    }