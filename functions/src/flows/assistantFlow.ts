import { gemini20Flash } from "@genkit-ai/vertexai";
import { type Genkit, type Role, z } from "genkit";
import { env } from "../env";
import {
  FAQ_ASSISTANT_SCHEMA,
  FAQ_ASSISTANT_SYSTEM_PROMPT,
} from "../prompts/faqAssistant";
import { vertexAIRetrieval } from "../tools/retrievalTool";

export const createFaqAssistantFlow = (ai: Genkit) =>
  ai.defineFlow(
    {
      name: "faqAssistantFlow",
      inputSchema: z.object({
        userPrompts: z.array(z.string()),
      }),
      outputSchema: z
        .object({
          completion: z.object({
            canAnswer: z.boolean(),
            reply: z.string().describe("顧客への返信文"),
            reason: z
              .string()
              .describe("回答の根拠。資料から該当箇所を詳細に抜き出すこと。"),
            note: z.string().nullable(),
          }),
          citations: z.array(z.string()),
          model: z.string(),
          usage: z.object({
            prompt_tokens: z.number(),
            completion_tokens: z.number(),
            total_tokens: z.number(),
          }),
        })
        .strict(),
    },
    async (input) => {
      const model = gemini20Flash;

      const { userPrompts } = input;
      const messages = userPrompts.map((prompt) => ({
        role: "user" as Role,
        content: [{ text: prompt }],
      }));

      // 関連FAQの取得
      const faqResults = await vertexAIRetrieval(
        userPrompts.join("\n"),
        env.GCLOUD_PROJECT_ID,
        "default_collection",
        env.DATASTORE_ID,
        "structData",
      );
      console.log("FAQ Result:", faqResults);

      if (faqResults && faqResults.length > 0) {
        messages.push({
          role: "model" as Role,
          content: [
            {
              text: `FAQから関連情報が見つかりました。\n${faqResults.map((item) => item.content).join("\n\n")}`,
            },
          ],
        });
      }

      const { output: completion, usage } = await ai.generate({
        model,
        system: FAQ_ASSISTANT_SYSTEM_PROMPT,
        messages: messages,
        config: {
          temperature: 0,
        },
        output: {
          schema: FAQ_ASSISTANT_SCHEMA,
        },
      });
      if (!completion) {
        throw new Error("No completion returned from the model.");
      }

      const response = {
        model: model.name,
        completion,
        citations: faqResults.map(
          (item) => `FAQ ID: ${item.pageNumber}\n${item.content}`,
        ),
        usage: {
          prompt_tokens: usage.inputTokens || 0,
          completion_tokens: usage.outputTokens || 0,
          total_tokens: usage.totalTokens || 0,
        },
      };

      return response;
    },
  );
