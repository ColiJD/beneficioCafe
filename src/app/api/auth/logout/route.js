import prisma from "@/lib/prisma";

export default async function handler(req, res) {
  const { userId } = JSON.parse(req.body);
  await prisma.password_resets.deleteMany({ where: { userId } });
  res.status(200).end();
}
