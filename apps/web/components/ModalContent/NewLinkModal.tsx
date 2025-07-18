import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import CollectionSelection from "@/components/InputSelect/CollectionSelection";
import TagSelection from "@/components/InputSelect/TagSelection";
import TextInput from "@/components/TextInput";
import unescapeString from "@/lib/client/unescapeString";
import { useRouter } from "next/router";
import Modal from "../Modal";
import { useTranslation } from "next-i18next";
import { useCollections } from "@linkwarden/router/collections";
import { useAddLink } from "@linkwarden/router/links";
import toast from "react-hot-toast";
import { PostLinkSchemaType } from "@linkwarden/lib/schemaValidation";
import { Button } from "@/components/ui/button";
import { Separator } from "../ui/separator";

type Props = {
  onClose: Function;
};

export default function NewLinkModal({ onClose }: Props) {
  const { t } = useTranslation();
  const initial = {
    name: "",
    url: "",
    description: "",
    type: "url",
    tags: [],
    collection: {
      id: undefined,
      name: "",
    },
  } as PostLinkSchemaType;

  const inputRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<PostLinkSchemaType>(initial);
  const addLink = useAddLink();
  const [submitLoader, setSubmitLoader] = useState(false);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const router = useRouter();
  const { data: collections = [] } = useCollections();

  const setCollection = (e: any) => {
    if (e?.__isNew__) e.value = undefined;
    setLink({
      ...link,
      collection: { id: e?.value, name: e?.label },
    });
  };

  const setTags = (selectedOptions: any = []) => {
    const tagNames = selectedOptions.map((option: any) => ({
      name: option.label,
    }));
    setLink({ ...link, tags: tagNames });
  };

  useEffect(() => {
    if (router.pathname.startsWith("/collections/") && router.query.id) {
      const currentCollection = collections.find(
        (e) => e.id == Number(router.query.id)
      );

      if (currentCollection && currentCollection.ownerId)
        setLink({
          ...initial,
          collection: {
            id: currentCollection.id,
            name: currentCollection.name,
          },
        });
    } else
      setLink({
        ...initial,
        collection: { name: "Unorganized" },
      });
  }, []);

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!submitLoader) {
      setSubmitLoader(true);
      const load = toast.loading(t("creating_link"));
      
      // Debug logging on client side
      console.log("🔍 NewLinkModal Debug:");
      console.log("Submitting link:", link);
      console.log("Link URL:", link.url);
      console.log("Link description:", link.description);
      
      await addLink.mutateAsync(link, {
        onSettled: (data, error) => {
          setSubmitLoader(false);
          toast.dismiss(load);
          if (error) {
            console.log("❌ Error creating link:", error);
            toast.error(t(error.message));
          } else {
            console.log("✅ Link created successfully:", data);
            onClose();
            toast.success(t("link_created"));
          }
        },
      });
    }
  };

  return (
    <Modal toggleModal={onClose}>
      <p className="text-xl font-thin">{t("create_new_link")}</p>

      <Separator className="my-3" />

      <div className="grid grid-flow-row-dense sm:grid-cols-5 gap-3">
        <div className="sm:col-span-3 col-span-5">
          <p className="mb-2">{t("link")}</p>
          <TextInput
            ref={inputRef}
            value={link.url || ""}
            onChange={(e) => setLink({ ...link, url: e.target.value })}
            placeholder={t("link_url_placeholder")}
            className="bg-base-200"
          />
        </div>
        <div className="sm:col-span-2 col-span-5">
          <p className="mb-2">{t("collection")}</p>
          {link.collection?.name && (
            <CollectionSelection
              onChange={setCollection}
              defaultValue={{
                value: link.collection?.id,
                label: link.collection?.name || "Unorganized",
              }}
            />
          )}
        </div>
      </div>
      {optionsExpanded && (
        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          <div>
            <p className="mb-2">{t("name")}</p>
            <TextInput
              value={link.name}
              onChange={(e) => setLink({ ...link, name: e.target.value })}
              placeholder={t("link_name_placeholder")}
              className="bg-base-200"
            />
          </div>
          <div>
            <p className="mb-2">{t("tags")}</p>
            <TagSelection
              onChange={setTags}
              defaultValue={
                link.tags?.map((e) => ({ label: e.name, value: e.id })) || []
              }
            />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2">{t("description")}</p>
            <textarea
              value={unescapeString(link.description || "") || ""}
              onChange={(e) =>
                setLink({ ...link, description: e.target.value })
              }
              placeholder={t("link_description_placeholder")}
              className="resize-none w-full h-32 rounded-md p-2 border-neutral-content bg-base-200 focus:border-primary border-solid border outline-none duration-100"
            />
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mt-5">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center px-2 w-fit text-sm"
          onClick={() => setOptionsExpanded(!optionsExpanded)}
        >
          <p>{optionsExpanded ? t("hide_options") : t("more_options")}</p>
          <i className={`bi-chevron-${optionsExpanded ? "up" : "down"}`} />
        </Button>
        <Button variant="accent" onClick={submit}>
          {t("create_link")}
        </Button>
      </div>
    </Modal>
  );
}
