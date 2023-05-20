'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const schema = require('@graphql-tools/schema');
const applicator = require('./applicator.js');
const validation = require('./validation.js');
const fragments = require('./fragments.js');
const utils = require('./utils.js');

function addMiddlewareToSchema(schema$1, options, middleware) {
  const validMiddleware = validation.validateMiddleware(schema$1, middleware);
  const resolvers = applicator.generateResolverFromSchemaAndMiddleware(schema$1, options, validMiddleware);
  const fragmentReplacements = fragments.extractFragmentReplacements(resolvers);
  const newSchema = schema.addResolversToSchema({
    schema: schema$1,
    resolvers,
    updateResolversInPlace: false,
    resolverValidationOptions: {
      requireResolversForResolveType: "ignore"
    }
  });
  return { schema: newSchema, fragmentReplacements };
}
function applyMiddlewareWithOptions(schema, options, ...middlewares) {
  console.time("GM: normalisedMiddlewares");
  const normalisedMiddlewares = middlewares.map((middleware) => {
    if (utils.isMiddlewareGenerator(middleware)) {
      return middleware.generate(schema);
    } else {
      return middleware;
    }
  });
  console.timeEnd("GM: normalisedMiddlewares");
  console.time("GM: schemaWithMiddlewareAndFragmentReplacements");
  const schemaWithMiddlewareAndFragmentReplacements = normalisedMiddlewares.reduceRight(({
    schema: currentSchema,
    fragmentReplacements: currentFragmentReplacements
  }, middleware) => {
    const {
      schema: newSchema,
      fragmentReplacements: newFragmentReplacements
    } = addMiddlewareToSchema(currentSchema, options, middleware);
    return {
      schema: newSchema,
      fragmentReplacements: [
        ...currentFragmentReplacements,
        ...newFragmentReplacements
      ]
    };
  }, { schema, fragmentReplacements: [] });
  console.timeEnd("GM: schemaWithMiddlewareAndFragmentReplacements");
  const schemaWithMiddleware = schemaWithMiddlewareAndFragmentReplacements.schema;
  schemaWithMiddleware.schema = schemaWithMiddlewareAndFragmentReplacements.schema;
  schemaWithMiddleware.fragmentReplacements = schemaWithMiddlewareAndFragmentReplacements.fragmentReplacements;
  return schemaWithMiddleware;
}
function applyMiddleware(schema, ...middlewares) {
  return applyMiddlewareWithOptions(schema, { onlyDeclaredResolvers: false }, ...middlewares);
}
function applyMiddlewareToDeclaredResolvers(schema, ...middlewares) {
  console.log("GM: applyMiddlewareToDeclaredResolvers");
  console.time("applyMiddlewareWithOptions");
  const result = applyMiddlewareWithOptions(schema, { onlyDeclaredResolvers: true }, ...middlewares);
  console.timeEnd("applyMiddlewareWithOptions");
  return result;
}

exports.addMiddlewareToSchema = addMiddlewareToSchema;
exports.applyMiddleware = applyMiddleware;
exports.applyMiddlewareToDeclaredResolvers = applyMiddlewareToDeclaredResolvers;
