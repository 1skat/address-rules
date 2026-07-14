import { Router } from "express";
import { authenticate } from "./middleware/authenticate.js";
import sql from "./internal/db.js";

const edgeRouter = Router();

edgeRouter.post("/", authenticate, async (req, res) => {
    // zod
    const { edgeId, chainId, source, target, sourceHandle, targetHandle } = req.body;

    try {
        await sql`
        INSERT INTO edges (id, chain_id, source, target, source_handle, target_handle)
        VALUES (
            ${edgeId},
            ${chainId},
            ${source},
            ${target},
            ${sourceHandle},
            ${targetHandle}
        )`;

        return res.status(201).end();
    } catch {
        return res.status(500).end();
    }
});

export default edgeRouter;


