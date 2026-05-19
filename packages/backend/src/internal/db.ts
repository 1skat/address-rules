import postgress from "postgres"
import { cfg } from "@/config.js"

const sql = postgress(cfg.db);

export default sql;
