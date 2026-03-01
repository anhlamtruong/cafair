import { authedProcedure } from "@/server/init";
import { recruiterActions } from "../schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const getActionsByCandidate = authedProcedure
  .input(z.object({ candidateId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.secureDb!.rls((tx) =>
      tx
        .select()
        .from(recruiterActions)
        .where(eq(recruiterActions.candidateId, input.candidateId)),
    );
  });
