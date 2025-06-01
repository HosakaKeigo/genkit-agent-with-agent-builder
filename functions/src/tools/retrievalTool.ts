import { SearchServiceClient } from "@google-cloud/discoveryengine";
import type { google } from "@google-cloud/discoveryengine/build/protos/protos.js";
const apiEndpoint = "discoveryengine.googleapis.com";
const client = new SearchServiceClient({ apiEndpoint: apiEndpoint });

/**
 * 解析タイプを定義
 */
export type ParseType = "extractiveAnswer" | "structData";

/**
 * extractive_answers フィールドから内容をパースする関数
 *
 * @param extractiveAnswers - extractive_answersフィールドの値
 * @returns パースされた抽出回答の配列
 */
function parseExtractiveAnswers(extractiveAnswers: google.protobuf.IValue) {
  const values = extractiveAnswers.listValue?.values;
  if (!values) return [];

  return values.map((value) => {
    const pageNumber = value.structValue?.fields?.pageNumber.stringValue;
    return {
      pageNumber,
      content: value.structValue?.fields?.content?.stringValue,
    };
  });
}

/**
 * structData フィールドから内容をパースする関数
 *
 * @param fields - structDataフィールドの値
 * @returns パースされた構造化データの配列
 */
function parseStructData(fields: Record<string, google.protobuf.IValue>) {
  if (!fields || !fields.question || !fields.answer) return [];

  const faqId = fields.faq_id?.numberValue?.toString() || "unknown";
  const question = fields.question.stringValue || "";
  const answer = fields.answer.stringValue || "";
  const action = fields.action?.stringValue || "";

  // questionとanswerを組み合わせてコンテンツとして返す
  const content = `質問: ${question}\n回答: ${answer}${action ? `\nアクション: ${action}` : ""}`;

  return [
    {
      pageNumber: faqId,
      content: content,
    },
  ];
}

/**
 * 検索結果から抽出回答を処理する関数
 *
 * @param searchResults - 検索APIから返された結果の配列
 * @param parseType - 解析タイプ
 * @returns 処理された抽出回答の配列
 */
function processSearchResults(
  searchResults: google.cloud.discoveryengine.v1.SearchResponse.ISearchResult[],
  parseType: ParseType,
) {
  if (!searchResults || searchResults.length === 0) {
    return [];
  }

  const docs = [];

  for (const result of searchResults) {
    if (parseType === "extractiveAnswer") {
      const fields = result.document?.derivedStructData?.fields;
      if (fields && "extractive_answers" in fields) {
        const extractiveAnswers = fields.extractive_answers;
        const extracts = parseExtractiveAnswers(extractiveAnswers);
        if (extracts.length > 0) {
          docs.push(...extracts);
        }
      }
    } else if (parseType === "structData") {
      const fields = result.document?.structData?.fields;
      if (fields) {
        const parsed = parseStructData(fields);
        if (parsed.length > 0) {
          docs.push(...parsed);
        }
      }
    }
  }

  return docs;
}

export async function vertexAIRetrieval(
  query: string,
  projectId: string,
  collectionId: string,
  dataStoreId: string,
  parseType: ParseType = "extractiveAnswer",
) {
  // The full resource name of the search engine serving configuration.
  // Example: projects/{projectId}/locations/{location}/collections/{collectionId}/dataStores/{dataStoreId}/servingConfigs/{servingConfigId}
  // You must create a search engine in the Cloud Console first.
  const name = client.projectLocationCollectionDataStoreServingConfigPath(
    projectId,
    "global",
    collectionId,
    dataStoreId,
    "default_serving_config",
  );

  const request: google.cloud.discoveryengine.v1.ISearchRequest = {
    pageSize: 10,
    query: query,
    servingConfig: name,
    contentSearchSpec: {
      extractiveContentSpec: {
        maxExtractiveAnswerCount: 5,
      },
    },
  };

  const IResponseParams = {
    ISearchResult: 0,
    ISearchRequest: 1,
    ISearchResponse: 2,
  };

  // Perform search request
  const response = await client.search(request, {
    // Warning: Should always disable autoPaginate to avoid iterate through all pages.
    autoPaginate: false,
  });
  const searchResponse = response[
    IResponseParams.ISearchResponse
  ] as google.cloud.discoveryengine.v1.ISearchResponse;
  const searchResults = searchResponse.results;

  // 検索結果から抽出回答を処理
  return processSearchResults(searchResults || [], parseType);
}
