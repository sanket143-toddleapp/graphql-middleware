import { addResolversToSchema } from '@graphql-tools/schema';
import { generateResolverFromSchemaAndMiddleware } from './applicator.mjs';
import { validateMiddleware } from './validation.mjs';
import { extractFragmentReplacements } from './fragments.mjs';
import { isMiddlewareGenerator } from './utils.mjs';

function addMiddlewareToSchema(schema, options, middleware) {
  const validMiddleware = validateMiddleware(schema, middleware);
  const resolvers = generateResolverFromSchemaAndMiddleware(schema, options, validMiddleware);
  const fragmentReplacements = extractFragmentReplacements(resolvers);
  const newSchema = addResolversToSchema({
    schema,
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
  console.log("middlewares", middlewares);
  const normalisedMiddlewares = middlewares.map((middleware) => {
    if (isMiddlewareGenerator(middleware)) {
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

export { addMiddlewareToSchema, applyMiddleware, applyMiddlewareToDeclaredResolvers };
