import { startFlowServer } from "@genkit-ai/express";
import { enableFirebaseTelemetry } from "@genkit-ai/firebase";
import { vertexAI } from "@genkit-ai/vertexai";
import { genkit } from "genkit";
import { createFaqAssistantFlow } from "./flows/assistantFlow";

enableFirebaseTelemetry();

const ai = genkit({
  plugins: [
    vertexAI({
      location: "us-central1",
    }),
  ],
});

startFlowServer({
  flows: [createFaqAssistantFlow(ai)],
});
