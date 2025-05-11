import bodyParser from "express";

export const post = [
    bodyParser.json(),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        console.log(req.body);
    }
]