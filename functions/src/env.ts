/**
 * 環境変数の型安全な取得のための設定
 *
 * @t3-oss/env-coreを使用して、必要な環境変数を定義し、
 * 存在チェックと型チェックを行う
 */
import { createEnv } from "@t3-oss/env-core";
import z from "zod";

/**
 * 環境変数の定義と検証
 *
 * GCLOUD_PROJECT_ID: Google Cloud Projectのプロジェクトを特定するためのID
 * DATASTORE_ID: Google Vertex AIのDatastore ID（RAGで使用）
 */
export const env = createEnv({
  server: {
    GCLOUD_PROJECT_ID: z.string().describe("Google Cloud Project ID"),
    DATASTORE_ID: z.string().describe("Google Vertex AI Datastore ID"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true, // 空文字列をundefinedとして扱う
});
