/**
 * The ambient surface a workflow program is written against: `Workflow` and
 * friends without an import, because zod is the only module a program may
 * import (proposal §13.1).
 */

import type { ZodTypeAny } from "zod";
import type {
  AskAnswer,
  AskSpec,
  StepHandle as Handle,
  Workflow as Runtime,
  WorkflowState as State,
  StepSpec,
} from "./workflow-program";

declare global {
  type Workflow<Inputs extends ZodTypeAny = ZodTypeAny> = Runtime<Inputs>;
  type StepHandle<Output extends ZodTypeAny = ZodTypeAny> = Handle<Output>;
  type WorkflowState<Schema extends ZodTypeAny> = State<Schema>;
  type WorkflowStepSpec<Output extends ZodTypeAny = ZodTypeAny> =
    StepSpec<Output>;
  type WorkflowAskSpec = AskSpec;
  type WorkflowAskAnswer = AskAnswer;
}
