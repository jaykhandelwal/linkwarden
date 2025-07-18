import { prisma } from "@linkwarden/prisma";
import fetchTitleAndHeaders from "@/lib/shared/fetchTitleAndHeaders";
import { createFolder } from "@linkwarden/filesystem";
import setCollection from "../../setCollection";
import {
  PostLinkSchema,
  PostLinkSchemaType,
} from "@linkwarden/lib/schemaValidation";
import { hasPassedLimit } from "@linkwarden/lib";

export default async function postLink(
  body: PostLinkSchemaType,
  userId: number
) {
  const dataValidation = PostLinkSchema.safeParse(body);

  if (!dataValidation.success) {
    return {
      response: `Error: ${
        dataValidation.error.issues[0].message
      } [${dataValidation.error.issues[0].path.join(", ")}]`,
      status: 400,
    };
  }

  const link = dataValidation.data;

  const linkCollection = await setCollection({
    userId,
    collectionId: link.collection?.id,
    collectionName: link.collection?.name,
  });

  if (!linkCollection)
    return { response: "Collection is not accessible.", status: 400 };

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (user?.preventDuplicateLinks) {
    const url = link.url?.trim().replace(/\/+$/, ""); // trim and remove trailing slashes from the URL
    const hasWwwPrefix = url?.includes(`://www.`);
    const urlWithoutWww = hasWwwPrefix ? url?.replace(`://www.`, "://") : url;
    const urlWithWww = hasWwwPrefix ? url : url?.replace("://", `://www.`);

    const existingLink = await prisma.link.findFirst({
      where: {
        OR: [{ url: urlWithWww }, { url: urlWithoutWww }],
        collection: {
          ownerId: userId,
        },
      },
    });

    if (existingLink)
      return {
        response: "Link already exists",
        status: 409,
      };
  }

  const hasTooManyLinks = await hasPassedLimit(userId, 1);

  if (hasTooManyLinks) {
    return {
      response: `Your subscription has reached the maximum number of links allowed.`,
      status: 400,
    };
  }

  const { title = "", description: extractedDescription = "", headers = new Headers() } = link.url
    ? await fetchTitleAndHeaders(link.url)
    : {};

  const name =
    link.name && link.name !== "" ? link.name : link.url ? title : "";

  // Use extracted description if user hasn't provided one
  const description = link.description && link.description !== "" 
    ? link.description 
    : extractedDescription;

  // Debug logging
  console.log("🔍 postLink Debug:");
  console.log("User provided description:", link.description);
  console.log("Extracted description:", extractedDescription);
  console.log("Final description to save:", description);

  const contentType = headers?.get("content-type");
  let linkType = "url";
  let imageExtension = "png";

  if (!link.url) linkType = link.type || "url";
  else if (contentType === "application/pdf") linkType = "pdf";
  else if (contentType?.startsWith("image")) {
    linkType = "image";
    if (contentType === "image/jpeg") imageExtension = "jpeg";
    else if (contentType === "image/png") imageExtension = "png";
  }

  if (!link.tags) link.tags = [];

  const newLink = await prisma.link.create({
    data: {
      url: link.url?.trim() || null,
      name,
      description,
      type: linkType,
      createdBy: {
        connect: {
          id: userId,
        },
      },
      collection: {
        connect: {
          id: linkCollection.id,
        },
      },
      tags: {
        connectOrCreate: link.tags?.map((tag) => ({
          where: {
            name_ownerId: {
              name: tag.name.trim(),
              ownerId: linkCollection.ownerId,
            },
          },
          create: {
            name: tag.name.trim(),
            owner: {
              connect: {
                id: linkCollection.ownerId,
              },
            },
          },
        })),
      },
    },
    include: { tags: true, collection: true },
  });

  await prisma.link.update({
    where: { id: newLink.id },
    data: {
      image: link.image
        ? `archives/${newLink.collectionId}/${newLink.id}.${
            link.image === "png" ? "png" : "jpeg"
          }`
        : undefined,
    },
  });

  createFolder({ filePath: `archives/${newLink.collectionId}` });

  return { response: newLink, status: 200 };
}
