import { getPageWithSections } from "../actions";
import { notFound } from "next/navigation";
import SiteBuilderClient from "./SiteBuilderClient";

export default async function PageBuilderPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const { page, sections, error } = await getPageWithSections(pageId);
  if (!page || error) notFound();
  return <SiteBuilderClient page={page} initialSections={sections} />;
}
