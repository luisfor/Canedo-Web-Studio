// File: automatismos/canedo-admin/src/modules/blog/editorial_pipeline.js
// Exportación unificada reutilizando el pipeline central con los 5 tipos y soporte seccional

export {
  generateArticleMarkdown,
  generateRobustArticle,
  parseMarkdownToBlocks,
  extractMetadataForArticle,
  countWordsInString
} from "../../../../canedostudio-blog-bot/src/editorial_pipeline.js";

export {
  validateEnrichedArticleData
} from "../../../../canedostudio-blog-bot/src/seo/service_mapping.js";

export {
  ARTICLE_TYPES,
  resolveArticleType,
  getBlogBotEligibleTypes
} from "../../../../canedostudio-blog-bot/src/article_types.js";

