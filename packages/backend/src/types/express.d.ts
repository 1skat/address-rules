declare namespace Express {
    interface Request {
        user: { sub: string, parent_id: string }
    }
}
