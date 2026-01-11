import z from "zod";

export const modelLoader = async (): Promise<string> => {
  return z.string().parse(process.env.AI_MODEL);
};