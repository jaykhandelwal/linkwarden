import type { NextApiRequest, NextApiResponse } from "next";
import fetchTitleAndHeaders from "@/lib/shared/fetchTitleAndHeaders";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url" });
  }
  const result = await fetchTitleAndHeaders(url);
  console.log("TEST META RESULT:", result);
  res.status(200).json(result);
} 