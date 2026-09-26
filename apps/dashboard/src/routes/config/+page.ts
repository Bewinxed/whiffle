import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

/** Wide screens open on Rules; a phone gets the rail itself as the page. */
export const load: PageLoad = async ({ parent }) => {
  const { narrow } = await parent();
  if (!narrow) {
    redirect(307, "/config/rules");
  }
};
